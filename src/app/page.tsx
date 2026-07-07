import { redirect } from "next/navigation";

// Poster tool is the only live view (Phase 1). Home becomes a hub later.
export default function Home() {
  redirect("/poster");
}
