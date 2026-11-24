// S3 互換のドライバ（関門 C4 の中だけ）。Supabase Storage の S3 互換 API・MinIO・AWS S3 に同じコードで当たる（D-049：supabase-js の storage クライアントは使わない）
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ExternalSigner, ObjectMeta, StorageDriver } from "./index.js";

export interface S3Settings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}
/** テストで差し替えられる最小の口（send だけ） */
export interface S3Like {
  send(cmd: unknown): Promise<unknown>;
}
export function s3Client(s: S3Settings): S3Client {
  const cfg: S3ClientConfig = {
    endpoint: s.endpoint,
    region: s.region,
    forcePathStyle: s.forcePathStyle ?? true,
    credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
  };
  return new S3Client(cfg);
}
const META_EXPIRES = "x-kaname-expires-at";

export function s3Driver(client: S3Like, bucket: string): StorageDriver & { exists(): Promise<boolean> } {
  return {
    async put(key, body, meta) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: meta.contentType,
          ContentLength: meta.size,
          Metadata: meta.expiresAt ? { [META_EXPIRES]: meta.expiresAt.toISOString() } : {},
        }),
      );
    },
    async get(key) {
      let out: {
        Body?: { transformToByteArray(): Promise<Uint8Array> };
        ContentType?: string;
        ContentLength?: number;
        Metadata?: Record<string, string>;
      };
      try {
        out = (await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))) as typeof out;
      } catch (e) {
        if ((e as { name?: string }).name === "NoSuchKey") return null;
        throw e;
      }
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      const exp = out.Metadata?.[META_EXPIRES];
      const meta: ObjectMeta = {
        size: out.ContentLength ?? bytes.byteLength,
        contentType: out.ContentType ?? "application/octet-stream",
        expiresAt: exp ? new Date(exp) : null,
      };
      return { body: bytes, meta };
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return true; // S3 の DeleteObject は無くても 204（存在の判定は get で）
    },
    /** 起動時の存在確認（G-11）：バケットが無ければ false。黙って 502 にしない */
    async exists() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return true;
      } catch {
        return false;
      }
    },
  };
}
/** プロビジョニング（冪等）：無ければ作る。infra/provision/bucket.ts から呼ぶ */
export async function ensureBucket(client: S3Like, bucket: string): Promise<"exists" | "created"> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return "exists";
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    return "created";
  }
}

/** 外の置き場の期限つき URL（D-128.160）：置き場の仕組み（S3 の署名つき URL・SigV4）で作る。Kaname の鍵では署名しない。
 *  URL は置き場の出どころ（endpoint・道の頭まで）の下で、道が「/<バケット>/<鍵>」（path-style）のものだけ。ほかは作らない（null） */
export function s3Presigner(client: S3Client, endpoint: string, bucket?: string): ExternalSigner {
  const ep = new URL(endpoint);
  const head = ep.pathname.replace(/\/$/, "");
  /** ブラウザが置き場へ直に置く上げ先（K-950）：大きさ（content-length）と種類（content-type）を署名に入れ、違う体は置き場が 403 で断る。
   *  置き場の名前を知らなければ持たない（ObjectStore はローカルの上げ先を出す） */
  const presignPut: ExternalSigner["presignPut"] = bucket
    ? (key, o) =>
        getSignedUrl(
          client,
          new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: o.contentType, ContentLength: o.size }),
          { expiresIn: o.ttlSec, signableHeaders: new Set(["content-length", "content-type"]) },
        )
    : undefined;
  return {
    ...(presignPut ? { presignPut } : {}),
    async presignGet(url, ttlSeconds) {
      if (url.origin !== ep.origin || !url.pathname.startsWith(`${head}/`)) return null;
      const rest = url.pathname
        .slice(head.length + 1)
        .split("/")
        .map(decodeURIComponent);
      const [bucket, ...key] = rest;
      if (!bucket || key.length === 0 || key.some((k) => !k || k === "." || k === "..")) return null;
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key.join("/") }), {
        expiresIn: ttlSeconds,
      });
    },
  };
}

/** 署名なしで確かめる先（K-133）。Supabase の S3 の口（…/storage/v1/s3）なら公開の読みの口（…/storage/v1/object/public/<バケット>/<鍵>）、
 *  ほかの S3 互換（MinIO・試験の偽の S3）は path-style の <口>/<バケット>/<鍵> */
export function bucketPublicUrl(endpoint: string, bucket: string, key: string): string {
  const ep = endpoint.replace(/\/+$/, "");
  const k = key.split("/").map(encodeURIComponent).join("/");
  if (/\/storage\/v1\/s3$/.test(ep))
    return `${ep.replace(/\/s3$/, "/object/public")}/${encodeURIComponent(bucket)}/${k}`;
  return `${ep}/${encodeURIComponent(bucket)}/${k}`;
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
export interface PrivateCheck {
  client: S3Like;
  presigner: ExternalSigner;
  endpoint: string;
  bucket: string;
  fetchImpl?: FetchLike;
}
/** 置き場が非公開かを、在る物で確かめる（K-133）。Supabase の公開の読みの口は、非公開のバケットでも公開のバケットで物が無いときでも
 *  400 を返すので、物が無いと見分けられない。確かめ用の物（鍵に乱数）を置き、署名つきで読めること（200）と、署名なしの公開の口で
 *  読めないこと（200 以外）の両方を見る。物は必ず消す。署名つきで読めなければ確かめられないので例外（private と言わない） */
export async function checkBucketPrivate(o: PrivateCheck): Promise<"private" | "public"> {
  const f = o.fetchImpl ?? fetch;
  const key = `.kaname-private-probe-${randomUUID()}`;
  await o.client.send(
    new PutObjectCommand({
      Bucket: o.bucket,
      Key: key,
      Body: new TextEncoder().encode("k133"),
      ContentType: "text/plain",
    }),
  );
  try {
    const signed = await o.presigner.presignGet(
      new URL(`${o.endpoint.replace(/\/+$/, "")}/${encodeURIComponent(o.bucket)}/${encodeURIComponent(key)}`),
      60,
    );
    if (!signed) throw new Error("非公開を確かめられない：確かめ用の物の署名 URL を作れない");
    const s = await f(signed);
    if (s.status !== 200) throw new Error(`非公開を確かめられない：確かめ用の物を署名つきで読めない（${s.status}）`);
    const p = await f(bucketPublicUrl(o.endpoint, o.bucket, key));
    return p.status === 200 ? "public" : "private";
  } finally {
    await o.client.send(new DeleteObjectCommand({ Bucket: o.bucket, Key: key }));
  }
}

/** プロビジョニングの本体（K-133・infra/provision/bucket.ts から呼ぶ）。終わりの番号（0 か 1）を返す */
export async function provisionBucket(
  o: PrivateCheck & { releaseBase: string; log: (line: string) => void },
): Promise<0 | 1> {
  const made = await ensureBucket(o.client, o.bucket);
  const under = `${o.endpoint.replace(/\/+$/, "")}/${o.bucket}/`;
  if (o.releaseBase && !`${o.releaseBase.replace(/\/+$/, "")}/`.startsWith(under)) {
    o.log(
      `[provision bucket] BRIDGE_RELEASE_BASE が置き場（${under}）の下にありません。BRIDGE_RELEASE_BASE=<STORAGE_ENDPOINT>/<STORAGE_BUCKET>/<頭> にする`,
    );
    return 1;
  }
  let r: "private" | "public";
  try {
    r = await checkBucketPrivate(o);
  } catch (e) {
    o.log(`[provision bucket] ${o.bucket} の非公開を確かめられない：${(e as Error).message}`);
    return 1;
  }
  if (r === "public") {
    o.log(`[provision bucket] 置き場が公開になっています（${o.bucket}）。置き場の画面でバケットを非公開に戻す`);
    return 1;
  }
  o.log(`[provision bucket] ${o.bucket} @ ${o.endpoint}: ${made}・private`);
  return 0;
}
