import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { isUuid } from "@/lib/validation/common";
import { validateProduct } from "@/lib/validation/master-data";
import { MAX_PHOTO_BYTES, detectImageType } from "@/lib/validation/image";
import { getAppSession, requirePermission } from "@/server/auth/session";
import { mapDbError, type UniqueRule } from "@/server/db-errors";
import {
  productPhotoStorage,
  productRepository,
  type ProductListParams,
} from "@/server/repositories/product.repository";

const UNIQUE_RULES: UniqueRule[] = [{ constraint: "gold_products_tenant_id_sku_key", field: "sku", message: "SKU sudah dipakai" }];

function mapProductError(e: unknown): AppError {
  const err = e as { code?: string };
  // Composite FK (tenant_id, category_id/purity_id): unknown id or another tenant's id
  if (err?.code === "23503") {
    return new AppError("VALIDATION_ERROR", "Kategori atau kadar tidak valid.", {
      categoryId: "Pilih kategori yang tersedia",
      purityId: "Pilih kadar yang tersedia",
    });
  }
  return mapDbError(e, UNIQUE_RULES);
}

function notFound(): never {
  throw new AppError("NOT_FOUND", "Produk tidak ditemukan.");
}

/** Validates an uploaded photo; returns null when no file was chosen. */
async function readPhoto(file: File | null): Promise<{ bytes: Uint8Array; mime: string; ext: string } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PHOTO_BYTES) {
    throw new AppError("VALIDATION_ERROR", "Foto maksimal 2 MB.", { photo: "Foto maksimal 2 MB" });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    throw new AppError("VALIDATION_ERROR", "Foto harus JPG, PNG, atau WEBP.", { photo: "Foto harus JPG, PNG, atau WEBP" });
  }
  return { bytes, mime: type.mime, ext: type.ext };
}

export const productService = {
  async list(params: ProductListParams) {
    if (!(await getAppSession())) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    const supabase = await createSupabaseServerClient();
    try {
      return await productRepository.list(supabase, {
        ...params,
        categoryId: isUuid(params.categoryId) ? params.categoryId : undefined,
      });
    } catch (e) {
      throw mapDbError(e);
    }
  },

  async get(id: string) {
    if (!(await getAppSession())) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    if (!isUuid(id)) notFound();
    const supabase = await createSupabaseServerClient();
    let row;
    try {
      row = await productRepository.getById(supabase, id);
    } catch (e) {
      throw mapDbError(e);
    }
    if (!row) notFound();
    return row;
  },

  /** Creates the product, then uploads the optional photo. A failed upload keeps the product (without photo). */
  async create(raw: Record<string, unknown>, photo: File | null): Promise<{ id: string; photoError?: string }> {
    const session = await requirePermission("master_data.manage");
    const parsed = validateProduct(raw);
    if (!parsed.valid) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", parsed.errors);
    const image = await readPhoto(photo);

    const supabase = await createSupabaseServerClient();
    let id: string;
    try {
      ({ id } = await productRepository.insert(supabase, parsed.data));
    } catch (e) {
      throw mapProductError(e);
    }

    if (image) {
      const path = `${session.tenant.id}/${id}/${randomUUID()}.${image.ext}`;
      try {
        await productPhotoStorage.upload(supabase, path, image.bytes, image.mime);
        await productRepository.update(supabase, id, { photo_path: path });
      } catch (e) {
        console.error("[product] photo upload failed", e);
        return { id, photoError: "Produk tersimpan, tetapi foto gagal diunggah. Coba unggah ulang." };
      }
    }
    return { id };
  },

  async update(id: string, raw: Record<string, unknown>, photo: File | null, removePhoto: boolean) {
    const session = await requirePermission("master_data.manage");
    if (!isUuid(id)) notFound();
    const parsed = validateProduct(raw);
    if (!parsed.valid) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", parsed.errors);
    const image = await readPhoto(photo);

    const supabase = await createSupabaseServerClient();
    const current = await productRepository.getById(supabase, id).catch((e) => {
      throw mapDbError(e);
    });
    if (!current) notFound();

    // Keep the existing SKU when the field is left empty (empty would regenerate it).
    const values = { ...parsed.data, sku: parsed.data.sku ?? current.sku };

    let newPath: string | null | undefined;
    if (image) {
      newPath = `${session.tenant.id}/${id}/${randomUUID()}.${image.ext}`;
      try {
        await productPhotoStorage.upload(supabase, newPath, image.bytes, image.mime);
      } catch (e) {
        console.error("[product] photo upload failed", e);
        throw new AppError("UPLOAD_FAILED", "Foto gagal diunggah. Silakan coba lagi.", { photo: "Foto gagal diunggah" });
      }
    } else if (removePhoto) {
      newPath = null;
    }

    try {
      const ok = await productRepository.update(supabase, id, newPath === undefined ? values : { ...values, photo_path: newPath });
      if (!ok) notFound();
    } catch (e) {
      if (newPath) await productPhotoStorage.remove(supabase, newPath);
      if (e instanceof AppError) throw e;
      throw mapProductError(e);
    }

    if (newPath !== undefined && current.photo_path) {
      await productPhotoStorage.remove(supabase, current.photo_path);
    }
  },

  async remove(id: string) {
    await requirePermission("master_data.manage");
    if (!isUuid(id)) notFound();
    const supabase = await createSupabaseServerClient();
    const current = await productRepository.getById(supabase, id).catch((e) => {
      throw mapDbError(e);
    });
    if (!current) notFound();
    try {
      await productRepository.remove(supabase, id);
    } catch (e) {
      throw mapDbError(e);
    }
    if (current.photo_path) await productPhotoStorage.remove(supabase, current.photo_path);
  },
};
