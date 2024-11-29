var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const sql = require("mssql");
const { receiveMessageOnPort } = require("worker_threads");

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// catch 404 and forward to error handler

//mac people do not change
//windows ppl change config to [i have no idea try to figure it out]
const config = {
  user: "sa",
  password: "dockerStrongPwd123",
  server: "localhost",
  database: "Telecom_Team_5",
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
let currMobileNo = "";
app.get("/", (req, res) => {
  res.render("login");
});

app.get("/customer", async (req, res) => {
  res.render("customer", { currMobileNo });
});

app.get("/admin", (req, res) => {
  res.render("admin");
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
      res.redirect("/customer");
    } else {
      res.redirect("/");
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

    const result = await pool.request().query("SELECT * FROM allBenefits");

    return result.recordset;
  } catch (err) {
    console.error("Error querying the view:", err);
  } finally {
    sql.close();
  }
}

async function notResolvedTickets(mobileNumber) {
  try {
    const pool = await sql.connect(config);
    const nationalIDres = await pool
      .request()
      .query(
        `SELECT nationalID FROM customer_account WHERE mobileNo = ${mobileNumber}`
      );
    const nationalID = nationalIDres.recordset[0].nationalID;
    const result = await pool
      .request()
      .input("NID", sql.Int, nationalID)
      .execute("Ticket_Account_Customer");
    return result.recordset[0];
  } catch (err) {
    console.error("Error querying the view:", err);
  } finally {
    sql.close();
  }
}

async function highestVoucher(mobileNumber) {
  try {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("mobile_num", sql.Char, mobileNumber)
      .execute("Account_Highest_Voucher");
    return result.recordset[0].voucherID;
  } catch (err) {
    console.error("Error querying the view:", err);
  } finally {
    sql.close();
  }
}

async function remAmount(paymentID, planID) {
  try {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("paymentId", sql.Int, paymentID)
      .input("planId", sql.Int, planID)
      .query(
        "SELECT dbo.function_remaining_amount(@paymentId, @planId) AS res"
      );
    return result.recordset[0].res;
  } catch (err) {
    console.error("Error querying the view:", err);
  } finally {
    sql.close();
  }
}

async function extraAmount(paymentID, planID) {
  try {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("paymentId", sql.Int, paymentID)
      .input("planId", sql.Int, planID)
      .query("SELECT dbo.function_extra_amount(@paymentId, @planId) AS res");
    return result.recordset[0].res;
  } catch (err) {
    console.error("Error querying the view:", err);
  } finally {
    sql.close();
  }
}

async function topSuccPayments(mobileNumber) {
  try {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("mobile_num", sql.Char, mobileNumber)
      .execute("Top_Successful_Payments");
    return result.recordset;
  } catch (err) {
    console.error("Error querying the view:", err);
  } finally {
    sql.close();
  }
}

// customer 3

const getShops = async () => {
  const pool = await sql.connect(config);
  const result = await pool.request().query("SELECT * from allShops");

  return result.recordset;
};

const servicePlans5Months = async (inputNum) => {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("MobileNo", sql.Char, inputNum)
    .query("SELECT * from dbo.Subscribed_plans_5_Months(@MobileNo)");
  return result.recordset;
};

const renewPlan = async (inputNum, amount, payment_method, plan_id) => {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, inputNum)
    .input("amount", sql.Decimal, amount)
    .input("payment_method", sql.VarChar, payment_method)
    .input("plan_id", sql.Int, plan_id)
    .execute("Initiate_plan_payment");
};

const cashbackAccount = async (inputNum, payment_id, benefit_id) => {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, inputNum)
    .input("payment_id", sql.Int, payment_id)
    .input("benefit_id", sql.Int, benefit_id)
    .execute("Payment_wallet_cashback");
};

const balanceRecharge = async (inputNum, amount, payment_method) => {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, inputNum)
    .input("payment_method", sql.VarChar, payment_method)
    .input("amount", sql.Int, amount)
    .execute("Initiate_balance_payment");
  //view should update whenever this is called
};

const redeemVoucher = async (inputNum, v_id) => {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, inputNum)
    .input("voucher_id", sql.Int, v_id)
    .execute("Redeem_voucher_points");
};

// admin 1

async function allCustomerAccounts() {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .query("SELECT * FROM allCustomerAccounts");
  return result.recordset;
}

async function physicalStoreVouchers() {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .query("SELECT * FROM PhysicalStoreVouchers");
  return result.recordset;
}

async function allResolvedTickets() {
  const pool = await sql.connect(config);
  const result = await pool.request().query("SELECT * FROM allResolvedTickets");
  return result.recordset;
}

async function accountPlan() {
  const pool = await sql.connect(config);
  const result = await pool.request().execute("Account_Plan");
  return result.recordset;
}

async function accountPlanDate(subDate, planId) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("sub_date", sql.Date, subDate)
    .input("plan_id", sql.Int, planId)
    .query("SELECT * FROM dbo.Account_Plan_Date(@sub_date,@plan_id)");
  return result.recordset;
}

async function accountSmsOffers(mobileNum) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, mobileNum)
    .query("SELECT * FROM dbo.Account_SMS_Offers(@mobile_num)");
  return result.recordset;
}

// admin 2

async function customerWallet() {
  const pool = await sql.connect(config);
  const result = await pool.request().query("SELECT * FROM CustomerWallet");
  return result.recordset;
}

async function eShopVouchers() {
  const pool = await sql.connect(config);
  const result = await pool.request().query("SELECT * FROM E_shopVouchers");
  return result.recordset;
}

async function accountPayments() {
  const pool = await sql.connect(config);
  const result = await pool.request().query("SELECT * FROM AccountPayments");
  return result.recordset;
}

async function numCashback() {
  const pool = await sql.connect(config);
  const result = await pool.request().query("SELECT * FROM Num_of_cashback");
  return result.recordset;
}

async function acceptedPayments(number) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, number)
    .execute("Account_Payment_Points");
  return result.recordset;
}

async function walletCashbackAmount(planID, walletID) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("planID", sql.Int, planID)
    .input("walletID", sql.Int, walletID)
    .query("SELECT dbo.Wallet_Cashback_Amount(@walletID, @planID) AS amount");
  return result.recordset[0].amount;
}

async function averageSentTransactions(startDate, endDate, walletID) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("start_date", sql.Date, startDate)
    .input("end_date", sql.Date, endDate)
    .input("walletID", sql.Int, walletID)
    .query(
      "SELECT dbo.Wallet_Transfer_Amount(@walletID, @start_date, @end_date) AS average"
    );
  console.log(result.recordset[0].average);
  return result.recordset[0].average;
}

async function walletLinked(number) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, number)
    .query("SELECT dbo.Wallet_MobileNo(@mobile_num) AS linked");
  console.log(result.recordset[0].linked);
  return result.recordset[0].linked;
}

async function updatePoints(number) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, number)
    .execute("Total_Points_Account");
}

app.listen(3000);
// module.exports = app;
