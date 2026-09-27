import PageHeader from "@/components/gold/PageHeader";
import ContactForm from "@/components/gold/master/ContactForm";
import { requirePagePermission } from "@/server/page-guard";
import { saveCustomerAction } from "../actions";

export default async function NewCustomerPage() {
  await requirePagePermission("customers.manage");
  return (
    <>
      <PageHeader title="Tambah Customer" back={{ href: "/customers", label: "Customer" }} />
      <ContactForm kind="customer" action={saveCustomerAction.bind(null, null)} />
    </>
  );
}
