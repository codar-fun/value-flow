"use client";
import { useEffect, useRef, useState } from "react";

type PendingImage = { key: string; file: File; url: string; error?: string; busy?: boolean };
export function ListingImagesEditor({ ids, onChange, onPending }: { ids: string[]; onChange: (ids: string[]) => void; onPending: (pending: boolean) => void }) {
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [error, setError] = useState("");
  const currentIds = useRef(ids);
  useEffect(() => { currentIds.current = ids; }, [ids]);
  const previews = useRef(new Set<string>());
  const running = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; const urls = previews.current; return () => { alive.current = false; urls.forEach((url) => URL.revokeObjectURL(url)); }; }, []);
  useEffect(() => { onPending(pending.length > 0); }, [pending.length, onPending]);
  async function upload(image: PendingImage) {
    if (running.current.has(image.key)) return;
    running.current.add(image.key);
    setPending((items) => items.map((item) => item.key === image.key ? { ...item, busy: true, error: "" } : item));
    try {
      const body = new FormData(); body.append("file", image.file); body.append("upload_key", image.key);
      const response = await fetch("/api/listing-images", { method: "POST", body });
      const result = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "上传失败，请重试");
      if (!alive.current) return;
      const next = [...currentIds.current, result.id]; currentIds.current = next; onChange(next);
      setPending((items) => items.filter((item) => item.key !== image.key));
      URL.revokeObjectURL(image.url); previews.current.delete(image.url);
    } catch (failure) {
      if (alive.current) setPending((items) => items.map((item) => item.key === image.key ? { ...item, busy: false, error: failure instanceof Error ? failure.message : "上传失败" } : item));
    } finally { running.current.delete(image.key); }
  }
  function choose(files: FileList | null) {
    setError("");
    if (!files) return;
    if (ids.length + pending.length + files.length > 3) { setError("每条内容最多 3 张图片"); return; }
    const accepted: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("请选择 JPG、PNG 或 WebP 图片，每张不超过 5 MB"); continue; }
      const url = URL.createObjectURL(file); previews.current.add(url); accepted.push({ file, url, key: crypto.randomUUID(), busy: true });
    }
    setPending((items) => [...items, ...accepted]);
    accepted.forEach((item) => void upload(item));
  }
  return <section className="listing-image-editor"><span className="form-label">图片（可选，最多 3 张）</span><small>在详情里查看和放大，分享海报保持纯文字。</small><div className="listing-image-grid">{ids.map((id) => <div key={id}><img src={`/api/listing-images/${encodeURIComponent(id)}`} alt="已上传的帖子图片"/><button type="button" onClick={() => { const next = ids.filter((item) => item !== id); currentIds.current = next; onChange(next); }}>移除</button></div>)}{pending.map((image) => <div key={image.key}><img src={image.url} alt={image.file.name}/>{image.busy ? <span role="status">上传中…</span> : <><p role="alert">{image.error}</p><button type="button" onClick={() => void upload(image)}>重试上传</button><button type="button" onClick={() => { setPending((items) => items.filter((item) => item.key !== image.key)); URL.revokeObjectURL(image.url); previews.current.delete(image.url); }}>移除</button></>}</div>)}</div><input aria-label="添加帖子图片" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={ids.length + pending.length >= 3} onChange={(event) => { choose(event.target.files); event.target.value = ""; }}/>{error && <p className="account-error" role="alert">{error}</p>}{pending.length > 0 && <p className="soft-note">图片上传完成后才能发布。未上传的图片在关闭草稿后需要重新选择。</p>}</section>;
}

export function ListingImages({ ids }: { ids: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (selected && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [selected]);
  return <>{ids.length > 0 && <div className="listing-image-grid">{ids.map((id, index) => <button type="button" key={id} onClick={() => setSelected(id)} aria-label={`放大第 ${index + 1} 张图片`}><img src={`/api/listing-images/${encodeURIComponent(id)}`} alt={`帖子图片 ${index + 1}`}/></button>)}</div>}{selected && <dialog ref={dialog} className="image-lightbox" role="dialog" aria-label="查看帖子图片" onClose={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><button autoFocus onClick={() => setSelected(null)}>关闭 ×</button><img src={`/api/listing-images/${encodeURIComponent(selected)}`} alt="放大的帖子图片"/></dialog>}</>;
}
