const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}.`;
    return { message, statusCode: 400 };
};

const handleDuplicateFieldsDB = (err) => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return { message, statusCode: 400 };
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map((el) => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return { message, statusCode: 400 };
};

const handleJWTError = () => ({
    message: 'Invalid token. Please log in again!',
    statusCode: 401,
});

const handleJWTExpiredError = () => ({
    message: 'Your token has expired! Please log in again.',
    statusCode: 401,
});

const errorMiddleware = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.stack = err.stack;

    if (err.name === 'CastError') {
    const customErr = handleCastErrorDB(err);
    error.message = customErr.message;
    error.statusCode = customErr.statusCode;
}

    if (err.code === 11000) {
    const customErr = handleDuplicateFieldsDB(err);
    error.message = customErr.message;
    error.statusCode = customErr.statusCode;
}

    if (err.name === 'ValidationError') {
    const customErr = handleValidationErrorDB(err);
    error.message = customErr.message;
    error.statusCode = customErr.statusCode;
}

    if (err.name === 'JsonWebTokenError') {
    const customErr = handleJWTError();
    error.message = customErr.message;
    error.statusCode = customErr.statusCode;
}

    if (err.name === 'TokenExpiredError') {
    const customErr = handleJWTExpiredError();
    error.message = customErr.message;
    error.statusCode = customErr.statusCode;
}

    const statusCode = error.statusCode || 500;
    const status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    res.status(statusCode).json({
    status,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        error: err 
    }),
});
};

export default errorMiddleware;