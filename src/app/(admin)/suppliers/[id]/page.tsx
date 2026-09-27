import DeleteButton from "@/components/gold/DeleteButton";
import PageHeader from "@/components/gold/PageHeader";
import ContactForm from "@/components/gold/master/ContactForm";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { supplierService } from "@/server/services/master-data.service";
import { deleteSupplierAction, saveSupplierAction } from "../actions";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("master_data.manage");
  const supplier = await loadPage(() => supplierService.get(id));

  return (
    <>
      <PageHeader title={`Ubah Supplier: ${supplier.name}`} back={{ href: "/suppliers", label: "Supplier" }} />
      <div className="space-y-6">
        <ContactForm kind="supplier" action={saveSupplierAction.bind(null, id)} initial={supplier} />
        <DeleteButton
          action={deleteSupplierAction.bind(null, id)}
          confirmText={`Hapus supplier "${supplier.name}"? Supplier yang sudah punya transaksi tidak bisa dihapus.`}
        />
      </div>
    </>
  );
}
