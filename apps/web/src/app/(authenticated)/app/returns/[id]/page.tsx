import { ReturnDetail } from "./return-detail";

export const metadata = { title: "Return Detail — Forumo" };

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReturnDetail id={id} />;
}
