export default function Home() {
  return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Worlds Crystal Ball Tracker</h1>
        <p className="text-gray-600">
          Import games data on the Admin page, then view live leaderboards on Crystal Ball.
        </p>
        <ul className="list-disc pl-6">
          <li><a className="underline" href="/admin/import">Admin: CSV Import</a></li>
          <li><a className="underline" href="/crystal-ball">Crystal Ball Leaderboards</a></li>
        </ul>
        <p className="text-sm text-gray-500">
          Tip: seed champions first (Aatrox, Ahri, Aurora, etc.), then import sample CSV to see real numbers.
        </p>
      </div>
  );
}
