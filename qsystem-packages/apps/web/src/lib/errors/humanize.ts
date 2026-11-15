/** Backend `code` values are internal; the user only ever sees these. */
const MESSAGES: Record<string, string> = {
  RATE_LIMITED: 'Bạn đã thử quá nhiều lần. Vui lòng đợi một phút rồi thử lại.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  REFRESH_REUSED: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Tài khoản của bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy nội dung cần xem.',
};

const BY_STATUS: Record<number, string> = {
  401: MESSAGES.UNAUTHORIZED,
  403: MESSAGES.FORBIDDEN,
  404: MESSAGES.NOT_FOUND,
  429: MESSAGES.RATE_LIMITED,
};

export function humanizeApiError(code?: string, status?: number): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (status && BY_STATUS[status]) return BY_STATUS[status];
  if (!status) return 'Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  if (status >= 500) return 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.';
  return 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}
