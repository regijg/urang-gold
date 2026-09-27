type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const generatePages = () => {
    let pages = [];

    // Jika total halaman <= 3, tampilkan semua
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    // Jika halaman awal (1–2)
    if (currentPage <= 2) return [1, 2, 3];

    // Jika halaman akhir
    if (currentPage >= totalPages - 1)
      return [totalPages - 2, totalPages - 1, totalPages];

    // Halaman di tengah
    return [currentPage - 1, currentPage, currentPage + 1];
  };

  const pages = generatePages();

  return (
    <div className="flex items-center">
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="mr-2 flex items-center h-7 justify-center rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
      >
        Previous
      </button>

      <div className="flex items-center gap-1">
        {/* Dots kiri */}
        {currentPage > 2 && totalPages > 3 && (
          <span className="px-1 text-xs">...</span>
        )}

        {/* Page numbers */}
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-2 py-1 rounded ${
              currentPage === page
                ? "bg-brand-500 text-white"
                : "text-gray-700 dark:text-gray-400"
            } flex w-7 h-7 items-center justify-center rounded-lg text-xs font-medium hover:bg-blue-500/[0.08] hover:text-brand-500 dark:hover:text-brand-500`}
          >
            {page}
          </button>
        ))}

        {/* Dots kanan */}
        {currentPage < totalPages - 1 && totalPages > 3 && (
          <span className="px-1 text-xs">...</span>
        )}
      </div>

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="ml-2 flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 shadow-theme-xs h-7 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
