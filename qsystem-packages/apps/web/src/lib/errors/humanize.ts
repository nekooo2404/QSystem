/** Backend `code` values are internal; the user only ever sees these. */
const MESSAGES: Record<string, string> = {
  RATE_LIMITED: 'Bạn đã thử quá nhiều lần. Vui lòng đợi một phút rồi thử lại.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  REFRESH_REUSED: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Tài khoản của bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy nội dung cần xem.',
  WRONG_PASSWORD: 'Mật khẩu hiện tại không đúng. Vui lòng kiểm tra lại.',
  VALIDATION: 'Dữ liệu nhập chưa hợp lệ. Vui lòng kiểm tra lại.',
  INVALID_INPUT: 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.',
  BAD_REQUEST: 'Yêu cầu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.',
  CONFLICT: 'Dữ liệu đã tồn tại hoặc đang xung đột trong hệ thống.',
  USER_EXISTS: 'Email này đã được đăng ký trong hệ thống.',
  CSRF_FORBIDDEN: 'Phiên yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.',
  PAYLOAD_TOO_LARGE: 'Dữ liệu tải lên vượt quá dung lượng cho phép.',
  TASK_4W_INCOMPLETE: 'Vui lòng điền đầy đủ các trường thông tin công việc bắt buộc.',
  INVALID_BUCKET: 'Thư mục lưu trữ không hợp lệ.',
  INVALID_KEY: 'Tên tệp không hợp lệ.',
  INVALID_SIZE: 'Dung lượng tệp vượt quá giới hạn cho phép.',
  INTERNAL: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.',
  NETWORK: 'Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng và thử lại.',
};

const BY_STATUS: Record<number, string> = {
  400: MESSAGES.BAD_REQUEST,
  401: MESSAGES.UNAUTHORIZED,
  403: MESSAGES.FORBIDDEN,
  404: MESSAGES.NOT_FOUND,
  409: MESSAGES.CONFLICT,
  413: MESSAGES.PAYLOAD_TOO_LARGE,
  422: MESSAGES.VALIDATION,
  429: MESSAGES.RATE_LIMITED,
};

export function humanizeApiError(code?: string, status?: number): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (status && BY_STATUS[status]) return BY_STATUS[status];
  if (!status) return MESSAGES.NETWORK;
  if (status >= 500) return MESSAGES.INTERNAL;
  return 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}
