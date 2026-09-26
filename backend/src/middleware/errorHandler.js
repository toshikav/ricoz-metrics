export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status =
    err.statusCode ||
    err.status ||
    (err.code === 11000
      ? 409
      : err.name === 'ValidationError' || err.name === 'CastError'
        ? 400
        : 500);
  if (status >= 500) console.error('Request failed:', err.name);
  res.status(status).json({
    success: false,
    error: {
      message:
        status >= 500
          ? 'The request could not be completed. Please retry.'
          : err.code === 11000
            ? 'A record with this name or version already exists.'
            : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
    timestamp: new Date().toISOString(),
  });
}
export const notFound = (req, res) =>
  res.status(404).json({ success: false, error: { message: 'Endpoint not found.' } });
