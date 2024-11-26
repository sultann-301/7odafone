var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const sql = require('mssql');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
 
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



//mac people do not change
//windows ppl change config to [i have no idea try to figure it out]
const config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  server: 'localhost',
  database: 'Telecom_Team_5',
  options: {
    encrypt: true,               // Enable encryption
    trustServerCertificate: true // Accept self-signed certificates
  }
};

async function fetchData() {
  try {
    const pool = await sql.connect(config);

    // Execute a query
    const result = await pool.request().query('SELECT * FROM allShops');
    
    // Access rows
    console.log(result.recordset); // Array of rows
    console.log(result.rowsAffected); // Number of rows affected
  } catch (err) {
    console.error('SQL error:', err);
  } finally {
    sql.close(); // Always close the connection
  }
}

fetchData();

app.listen(3000);
// module.exports = app;
