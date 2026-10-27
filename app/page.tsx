import Dashboard from "@/components/dashboard/Dashboard";

export default function Home() {
  return (
    <main className="wrap">
      <Dashboard />
      <p className="note">
        The bot only sends alerts and webhooks, it never places orders by itself. Trading
        forex and gold is risky and this is not financial advice.
      </p>
    </main>
  );
}
