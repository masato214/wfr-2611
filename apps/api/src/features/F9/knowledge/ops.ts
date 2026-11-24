// ナレッジの口の持ち主の表（K-675・土台 2・5 章）：操作 ID → 口の振る舞いを作る葉と、口の登録のファイル（apps/api/src/hooks/<file>.ts）。
//   1 つの口は 1 つのファイルだけが持つ（K675-API-020 が見る）。表に無い口を hooks のファイルに書かない。足すときは K-675 に頼む
export interface KnowledgeOpOwner {
  /** 口の振る舞いを作る葉 */
  readonly leaf: string;
  /** 口の登録のファイル（apps/api/src/hooks/ の下・拡張子なし） */
  readonly file: string;
}

const own = (leaf: string, file: string): KnowledgeOpOwner => Object.freeze({ leaf, file: `f9-knowledge-${file}` });

export const KNOWLEDGE_OPS: Readonly<Record<string, KnowledgeOpOwner>> = Object.freeze({
  getKnowledgeTree: own("K-676", "tree"),
  getKnowledgePage: own("K-677", "page-read"),
  listKnowledgeVersions: own("K-677", "page-read"),
  getKnowledgePageVersion: own("K-677", "page-read"),
  createKnowledgeFolder: own("K-678", "folders"),
  updateKnowledgeFolder: own("K-678", "folders"),
  deleteKnowledgeFolder: own("K-678", "folders"),
  createKnowledgePage: own("K-679", "draft"),
  saveKnowledgeDraft: own("K-679", "draft"),
  discardKnowledgeDraft: own("K-679", "draft"),
  publishKnowledgePage: own("K-680", "publish"),
  updateKnowledgePage: own("K-681", "page-edit"),
  deleteKnowledgePage: own("K-681", "page-edit"),
  setKnowledgeMust: own("K-685", "must"),
  findSimilarKnowledge: own("K-686", "similar"),
  requestKnowledgeRaise: own("K-687", "raise"),
  withdrawKnowledgeRequest: own("K-687", "raise"),
  dismissKnowledgeRequest: own("K-687", "raise"),
  listKnowledgeApprovals: own("K-688", "approvals"),
  approveKnowledgeRequest: own("K-688", "approvals"),
  declineKnowledgeRequest: own("K-688", "approvals"),
  getKnowledgeShares: own("K-689", "shares"),
  setKnowledgeShares: own("K-689", "shares"),
  copyKnowledgePage: own("K-690", "copy"),
  getKnowledgeReview: own("K-695", "review"),
});
