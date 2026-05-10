import { LoginForm } from "@/components/simera/LoginForm";

type Props = {
  searchParams: Promise<{ from?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp.from;
  const fromParam = Array.isArray(raw) ? raw[0] : raw;
  const redirectTo =
    typeof fromParam === "string" && fromParam.startsWith("/")
      ? fromParam
      : "/";

  return <LoginForm redirectTo={redirectTo} />;
}
