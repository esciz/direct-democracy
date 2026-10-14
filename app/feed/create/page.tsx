import { redirect } from "next/navigation";

export default function LegacyFeedCreatePage() {
  redirect("/posts/create");
}
