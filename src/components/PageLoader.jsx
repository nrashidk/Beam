export default function PageLoader() {
  return (
        <div className="min-h-screen fixed inset-0 flex flex-col items-center justify-center text-center">
  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  <p className="text-gray-600 mt-4">Loading...</p>
</div>

  );
}
