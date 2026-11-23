// 本文の道具の「よく使う色」の見本（下絵・段 5）。これは文書の中身の色（利用者が字や背景に付ける色）で、
//   画面の部品のデザイン（正本のトークン）ではない。値は #rrggbb（小文字 6 桁）。画面の CSS には書かず、見本の四角にだけ当てる
export interface Swatch {
  name: string;
  value: string;
}
export const TEXT_SWATCHES: readonly Swatch[] = [
  { name: "黒", value: "#1f2937" },
  { name: "灰", value: "#6b7280" },
  { name: "赤", value: "#dc2626" },
  { name: "橙", value: "#ea580c" },
  { name: "黄", value: "#ca8a04" },
  { name: "緑", value: "#16a34a" },
  { name: "青緑", value: "#0d9488" },
  { name: "青", value: "#2563eb" },
  { name: "紫", value: "#7c3aed" },
  { name: "桃", value: "#db2777" },
];
export const BG_SWATCHES: readonly Swatch[] = [
  { name: "灰", value: "#e5e7eb" },
  { name: "赤", value: "#fecaca" },
  { name: "橙", value: "#fed7aa" },
  { name: "黄", value: "#fde68a" },
  { name: "緑", value: "#bbf7d0" },
  { name: "青緑", value: "#99f6e4" },
  { name: "青", value: "#bfdbfe" },
  { name: "紫", value: "#ddd6fe" },
  { name: "桃", value: "#fbcfe8" },
];
