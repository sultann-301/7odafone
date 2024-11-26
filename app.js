var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const sql = require('mssql');



var app = express();
 
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// catch 404 and forward to error handler




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

// async function fetchData() {
//   try {
//     const pool = await sql.connect(config);

//     // Execute a query
//     const result = await pool.request().query('SELECT * FROM Customer_account');
    
//     // Access rows
//     console.log(result.recordset); // Array of rows
//     console.log(result.rowsAffected); // Number of rows affected
//   } catch (err) {
//     console.error('SQL error:', err);
//   } finally { 
//     sql.close(); // Always close the connection
//   }
// }
let currMobileNo = ''
app.get('/', (req,res) =>
{
  res.render('login')
})

app.get('/customer', (req,res) =>
{
  res.render('customer', {currMobileNo})
})


app.post('/', async (req, res) =>{
  const pool = await sql.connect(config);
  const password = req.body.password
  const mobileNo = req.body.mobileNo
  console.log(password, mobileNo);
  
  if(mobileNo=='1' && password == 'hamoksha')
  {
    res.redirect('admin')
  } else
  {
    const result = await pool.request()
                .input('password', sql.VarChar, password)
                .input('mobileNumber', sql.Char, mobileNo)
                .query('SELECT dbo.AccountLoginValidation(@password, @mobileNumber) AS status');
  const status = result.recordset[0].status
  currMobileNo = mobileNo
  if(status)
  {
    res.redirect('/customer')
  } else 
  {
    res.redirect('/')
  }

  }

  

})


// fetchData();

app.listen(3000);
// module.exports = app;
