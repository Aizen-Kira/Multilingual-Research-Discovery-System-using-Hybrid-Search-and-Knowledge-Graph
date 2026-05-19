export default function PaperPanel() {
  return (
    <div className="w-[32%] border-r px-6 py-6 overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">Example Research Paper</h1>

      <h2 className="font-semibold mb-2">Abstract</h2>
      <p className="text-sm leading-relaxed mb-6">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua.
      </p>

      <h2 className="font-semibold mb-2">Keywords</h2>
      <p className="text-sm">AI, ML, Research</p>
    </div>
  );
}
