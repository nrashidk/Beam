export default function PageLoader() {
  return (
    // <div className="flex items-center justify-center h-screen">
    //   <div className="flex flex-col items-center gap-4">
    //     <Loader className="h-12 w-12 text-indigo-600 animate-spin" />
    //     <p className="text-gray-600 font-medium">Loading...</p>
    //   </div>
    // </div>
        <div className="min-h-screen flex flex-col items-center justify-center text-center">
  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  <p className="text-gray-600 mt-4">Loading...</p>
</div>

  );
}
