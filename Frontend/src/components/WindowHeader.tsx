export default function WindowHeader() {
  return (
    <div className="h-10 flex items-center px-4 border-b bg-gray-50">
      <div className="flex gap-2">
        <span className="w-3 h-3 bg-red-500 rounded-full" />
        <span className="w-3 h-3 bg-yellow-400 rounded-full" />
        <span className="w-3 h-3 bg-green-500 rounded-full" />
      </div>

      <div className="flex-1 mx-6">
        <input
          placeholder="Search"
          className="w-full px-3 py-1 text-sm rounded-md border bg-white"
        />
      </div>

      <div className="text-xl">☰</div>
    </div>
  );
}
