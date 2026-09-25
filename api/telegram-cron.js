export default async function handler(req, res) {
  res.status(200).json({ ok: true, test: "telegram-cron minimal" });
}