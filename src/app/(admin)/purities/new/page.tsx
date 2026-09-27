import PageHeader from "@/components/gold/PageHeader";
import PurityForm from "@/components/gold/master/PurityForm";
import { requirePagePermission } from "@/server/page-guard";
import { savePurityAction } from "../actions";

export default async function NewPurityPage() {
  await requirePagePermission("master_data.manage");
  return (
    <>
      <PageHeader title="Tambah Kadar" back={{ href: "/purities", label: "Kadar Emas" }} />
      <PurityForm action={savePurityAction.bind(null, null)} />
    </>
  );
}
