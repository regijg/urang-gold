import Swal from 'sweetalert2'

export const showSuccess = (message: string = 'Success!') => {
  Swal.fire({
    icon: 'success',
    title: 'Berhasil',
    text: message,
    timer: 2000,
    showConfirmButton: false,
    timerProgressBar: true,
    position: 'top-end',
    toast: true,
    didOpen: (popup) => {
      // Paksa style inline z-index tinggi
      popup.parentElement!.style.zIndex = "999999"; // ⬅️ ini kuncinya
    },
  })
}

export const showError = (message: string = 'Terjadi kesalahan') => {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
    timer: 3000,
    showConfirmButton: false,
    timerProgressBar: true,
    position: 'bottom-end',
    toast: true,
    didOpen: (popup) => {
      // Paksa style inline z-index tinggi
      popup.parentElement!.style.zIndex = "999999"; // ⬅️ ini kuncinya
    },
  })
}

export const showErrorSession = (message: string = 'Session telah berakhir') => {
  Swal.fire({
    icon: 'error',
    title: 'Sesi Berakhir',
    text: 'Kesalahan server, silahkan kontak admin.',
    confirmButtonText: 'Login Ulang',
    allowOutsideClick: false,
    allowEscapeKey: false,
    position: 'center',
    customClass: {
      title: 'swal2-sm-title',
    },
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      window.location.href = '/signin';
    }
  });
};