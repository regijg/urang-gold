import PageHeader from "@/components/gold/PageHeader";
import ContactForm from "@/components/gold/master/ContactForm";
import { requirePagePermission } from "@/server/page-guard";
import { saveSupplierAction } from "../actions";

export default async function NewSupplierPage() {
  await requirePagePermission("master_data.manage");
  return (
    <>
      <PageHeader title="Tambah Supplier" back={{ href: "/suppliers", label: "Supplier" }} />
      <ContactForm kind="supplier" action={saveSupplierAction.bind(null, null)} />
    </>
  );
}
