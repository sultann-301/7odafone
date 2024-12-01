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
    encrypt: true, // Enable encryption
    trustServerCertificate: true, // Accept self-signed certificates
  },
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

/*<div>
    <% function renderObject(obj) { %>
      <% if (Array.isArray(obj)) { %>
        <ul>
          <% obj.forEach(item => { %>
            <li><%= renderObject(item) %></li>
          <% }) %>
        </ul>
      <% } else if (typeof obj === 'object' && obj !== null) { %>
        <ul>
          <% Object.keys(obj).forEach(key => { %>
            <li>
              <strong><%= key %>:</strong>
              <%= renderObject(obj[key]) %>
            </li>
          <% }) %>
        </ul>
      <% } else { %>
        <span><%= obj %></span>
      <% } %>
    <% } %>
    <div>
      <% renderObject(dish); %>
    </div>
  </div>
  */
const cookData = async (currMobileNo) => {
const dish={};
dish.allServicePlans = await allServicePlans();
dish.unsubscribedPlans = await unsubscribedPlans(currMobileNo);
dish.showUsage = await showUsage(currMobileNo);
const pool=await sql.connect(config);
var NID = await pool
        .request()
        .query(
          `SELECT nationalID FROM customer_account WHERE mobileNo =${currMobileNo}`
        );
const {nationalID} = NID.recordset[0];
dish.name= await pool
.request()
.query(
  `SELECT first_name + ' ' + last_name AS name FROM customer_profile WHERE nationalID =${nationalID}`
);
dish.CashbackWallet = await CashbackWallet(nationalID);
dish.activeBenefits = await activeBenefits();
dish.notResolvedTickets = await notResolvedTickets(currMobileNo);
dish.highestVoucher = await highestVoucher(currMobileNo);
dish.topSuccPayments = await topSuccPayments(currMobileNo);
dish.getShops = await getShops();
dish.servicePlans5Months = await servicePlans5Months(currMobileNo);
console.log(dish)
return dish;
}





const cookDataAdmin = async () => {
  const dish = {};
  dish.allCustomerAccounts = await allCustomerAccounts();
  dish.physicalStoreVouchers = await physicalStoreVouchers();
  dish.allResolvedTickets = await allResolvedTickets();
  dish.accountPlan = await accountPlan();
  dish.customerWallet = await customerWallet();
  dish.eShopVouchers = await eShopVouchers();
  dish.accountPayments = await accountPayments();
  dish.numCashback = await numCashback();
  return dish;
}

let currMobileNo = "";
app.get("/", (req, res) => {
  res.render("login", { invalid: false });
});

app.get("/customer", async (req, res) => {
  const dish = await cookData(currMobileNo);
  const name = dish.name.recordset[0].name;
  const usages = dish.showUsage;
  for (let i = 0; i < usages.length; i++){
    for (let j = 0; j < dish.allServicePlans.length; j++){
      let plan = dish.allServicePlans[j] 
      if (plan.name == usages[i].name){
        usages[i].data_consumption = Math.round((usages[i].data_consumption/plan.data_offered) * 100)
        usages[i].SMS_sent = Math.round((usages[i].SMS_sent/plan.SMS_offered) * 100)
        usages[i].minutes_used = Math.round((usages[i].minutes_used/plan.minutes_offered) * 100)
      }
    }
  }
  res.render("customer", { dish , name, usages});
});

app.get("/myplans", async(req, res) => {
  const dish = await cookData(currMobileNo);
  const name = dish.name.recordset[0].name;
  res.render("myplans",{dish, name, usages : [
    {
      name: '',
      data_consumption: 0,
      minutes_used: 0,
      SMS_sent: 0
    },
  ]});
});

app.post("/myplans", async(req, res) => {
  const start = req.body.startDate
  const end = req.body.endDate
  const plan = req.body.plan
  const dish = await cookData(currMobileNo);
  const name = dish.name.recordset[0].name;
  const usages = await Consumption(plan, start, end)
  for (let i = 0; i < usages.length; i++){
    for (let j = 0; j < dish.allServicePlans.length; j++){
      let plan = dish.allServicePlans[j] 
      if (plan.name == usages[i].name){
        usages[i].data_consumption = Math.round((usages[i].data_consumption/plan.data_offered) * 100)
        usages[i].SMS_sent = Math.round((usages[i].SMS_sent/plan.SMS_offered) * 100)
        usages[i].minutes_used = Math.round((usages[i].minutes_used/plan.minutes_offered) * 100)
      }
    }
  }
  res.render("myplans",{dish, name, usages});
});

app.get("/admin", async(req, res) => {
  const dish = await cookDataAdmin();
  res.render("admin",{dish});
});


app.get("/benefits", async(req, res) => {
  const benefit = await activeBenefits();
  res.render("benefits",{benefit,currMobileNo});
});

app.get("/plans", async(req, res) => {
  const service = await allServicePlans();
  const unsub = await unsubscribedPlans(currMobileNo)
  res.render("plans",{service,unsub});
});

app.get("/wallet", async(req, res) => {
  const benefit = await activeBenefits();
  res.render("wallet");
});

app.get("/shops", async(req, res) => {
  const dish = await cookData(currMobileNo);
  const shops = dish.getShops
  const name = dish.name.recordset[0].name;
  res.render("shops",{shops, name});
});

app.post("/", async (req, res) => {
  const pool = await sql.connect(config);
  const password = req.body.password;
  const mobileNo = req.body.mobileNo;
  console.log(password, mobileNo);

  if (mobileNo == "1" && password == "hamoksha") {
    res.redirect("admin");
  } else {
    const result = await pool
      .request()
      .input("password", sql.VarChar, password)
      .input("mobileNumber", sql.Char, mobileNo)
      .query(
        "SELECT dbo.AccountLoginValidation(@mobileNumber, @password) AS status"
      );
    const status = result.recordset[0].status;
    currMobileNo = mobileNo;
    if (status) {
      cookData(currMobileNo)
      res.redirect("/customer");
    } else {
      res.render("login", { invalid: true });
    }
  }
});

// customer 1

async function allServicePlans() {
  const pool = await sql.connect(config);
  const result = await pool.request().query("SELECT * FROM allServicePlans");

  return result.recordset;
}

async function Consumption(name, start_date, end_date) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("plan_name", sql.VarChar, name)
    .input("start_date", sql.VarChar, start_date)
    .input("end_date", sql.VarChar, end_date)
    .query("SELECT * FROM dbo.Consumption(@plan_name, @start_date, @end_date)");

  return result.recordset;
}

async function unsubscribedPlans(number) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.VarChar, number)
    .execute("Unsubscribed_Plans");
  return result.recordset;
}

async function showUsage(number) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, number)
    .query("SELECT * FROM dbo.Usage_Plan_CurrentMonth(@mobile_num)");
  return result.recordset;
}

async function CashbackWallet(nationalID) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("NID", sql.Int, nationalID)
    .query("SELECT * FROM dbo.Cashback_Wallet_Customer(@NID)");

  return result.recordset;
}

// customer 2

async function activeBenefits() {
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
