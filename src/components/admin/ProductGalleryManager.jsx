import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';
import { moveImage, nextSortOrder } from '../../utils/productImages';

const authHint = 'ต้องเข้าสู่ระบบแอดมินผ่าน Supabase Auth และรัน migration 0013 แล้ว';

export default function ProductGalleryManager({ productId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0); // files left to upload
  const [busy, setBusy] = useState(false);

  const reloadQuiet = async () => {
    const data = await api.getProductImages(productId);
    setImages(data);
  };

  const load = async () => {
    setLoading(true);
    await reloadQuiet();
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  useEffect(() => {
    const sub = api.subscribeTable('product_images', reloadQuiet);
    return () => sub.unsubscribe();
  }, [productId]);

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    let order = nextSortOrder(images);
    setUploading(files.length);
    try {
      for (const file of files) {
        const url = await api.uploadProductImage(file, 'gallery');
        if (url) await api.addProductImage(productId, url, order++);
        setUploading((n) => n - 1);
      }
    } catch (err) {
      console.error(err);
      alert('อัปโหลดรูปไม่สำเร็จ: ' + (err.message || '') + '\n' + authHint);
    } finally {
      setUploading(0);
      reloadQuiet();
    }
  };

  const handleDelete = async (img) => {
    if (!window.confirm('ลบรูปนี้?')) return;
    setBusy(true);
    try {
      await api.deleteProductImage(img.id);
    } catch (err) {
      alert('ลบรูปไม่สำเร็จ: ' + (err.message || '') + '\n' + authHint);
    } finally {
      setBusy(false);
      reloadQuiet();
    }
  };

  const handleMove = async (index, delta) => {
    const next = moveImage(images, index, delta);
    const changed = next.filter((img) => images.find((o) => o.id === img.id)?.sort_order !== img.sort_order);
    if (changed.length === 0) return;
    setImages(next);
    setBusy(true);
    try {
      await api.reorderProductImages(changed);
    } catch (err) {
      alert('จัดลำดับรูปไม่สำเร็จ: ' + (err.message || '') + '\n' + authHint);
    } finally {
      setBusy(false);
      reloadQuiet();
    }
  };

  if (loading) return <div className="text-xs text-zinc-400 font-mono">กำลังโหลดแกลเลอรีรูปสินค้า...</div>;

  return (
    <div className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
      <div>
        <h5 className="font-bold text-xs text-zinc-800">แกลเลอรีรูปสินค้า (เพิ่มเติม)</h5>
        <p className="text-[10px] text-zinc-500 mt-0.5">แสดงต่อจากรูปหน้า/หลังในหน้ารายละเอียดสินค้า · เลือกได้หลายไฟล์พร้อมกัน</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {images.map((img, i) => (
          <div key={img.id} className="w-20 space-y-1">
            <div className="relative w-20 h-20">
              <img loading="lazy" decoding="async" src={img.image_url} alt="" className="w-full h-full object-cover rounded border" />
              <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/70 text-white text-[9px] font-mono">{i + 1}</span>
              <button
                type="button"
                onClick={() => handleDelete(img)}
                disabled={busy}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] leading-4 disabled:opacity-40"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleMove(i, -1)}
                disabled={busy || i === 0}
                title="ย้ายไปก่อนหน้า"
                className="flex-1 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 disabled:opacity-30"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => handleMove(i, 1)}
                disabled={busy || i === images.length - 1}
                title="ย้ายไปถัดไป"
                className="flex-1 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 disabled:opacity-30"
              >
                ▶
              </button>
            </div>
          </div>
        ))}
        <label className={`w-20 h-20 border-2 border-dashed border-zinc-300 rounded flex items-center justify-center text-xs text-zinc-400 ${uploading ? 'cursor-wait' : 'cursor-pointer'}`}>
          {uploading ? `...${uploading}` : '+ รูป'}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading > 0}
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
          />
        </label>
      </div>
    </div>
  );
}
