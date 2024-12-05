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


const cookData = async (currMobileNo) => {
const dish={};
dish.allServicePlans = await allServicePlans();
dish.unsubscribedPlans = await unsubscribedPlans(currMobileNo);
dish.showUsage = await showUsage(currMobileNo);
const pool=await sql.connect(config);
const vouchers = await pool.request().query(`SELECT V.* FROM Voucher V WHERE V.mobileNo = ${currMobileNo}`)
dish.vouchers = vouchers.recordset
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
dish.balance = await pool.request().query(`SELECT current_balance, last_modified_date from Wallet WHERE nationalID =${nationalID}`)
dish.CashbackWallet = await CashbackWallet(nationalID);
dish.activeBenefits = await activeBenefits();
dish.notResolvedTickets = await notResolvedTickets(currMobileNo);
dish.highestVoucher = await highestVoucher(currMobileNo);
dish.topSuccPayments = await topSuccPayments(currMobileNo);
dish.getShops = await getShops();
dish.servicePlans5Months = await servicePlans5Months(currMobileNo);
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
  let usages = await Consumption(plan, start, end)
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
  if (usages.length == 0) usages = [{
    name: 'No usages for this plan in this period',
    data_consumption: 0,
    minutes_used: 0,
    SMS_sent: 0
  }]
  res.render("myplans",{dish, name, usages});
});

app.get("/profileAdmin", async(req, res) => {
  const dish = await cookDataAdmin();
  res.render("profileAdmin",{dish});
});

app.get("/pshops", async(req, res) => {
  const dish = await cookDataAdmin();
  res.render("pshops",{dish});
});

app.get("/eshops", async(req, res) => {
  const dish = await cookDataAdmin();
  res.render("eshops",{dish});
});

app.get("/paymentAdmin", async(req, res) => {
  const dish = await cookDataAdmin();
  res.render("paymentAdmin",{dish});
});

app.get("/ticketAdmin", async(req, res) => {
  const dish = await cookDataAdmin();
  res.render("ticketAdmin",{dish});
});

app.get("/walletAdmin", async(req, res) => {
  const dish = await cookDataAdmin();
  res.render("walletAdmin",{dish});
});

app.get("/accountAdmin", async(req, res) => {
  const dish = await cookDataAdmin();
  for (let i = 0; i < dish.accountPlan.length; i++){
    let linked = await walletLinked(dish.accountPlan[i].mobileNo)
    let accepted = await acceptedPayments(dish.accountPlan[i].mobileNo)
    dish.accountPlan[i].linked = linked
    dish.accountPlan[i].acceptedPayments = accepted
  }
  res.render("accountAdmin",{dish, usages : [], accounts : [], success : 2});
});

app.post("/accountAdmin", async(req, res) => {
  const action = req.body.action;
  const dish = await cookDataAdmin()
  for (let i = 0; i < dish.accountPlan.length; i++){
    let linked = await walletLinked(dish.accountPlan[i].mobileNo)
    dish.accountPlan[i].linked = linked
  }
  if (action == 'revoke'){
    const plan = req.body.planRevoke
    const account = req.body.accountRevoke
    const rows = await benefitsAccounts(account, plan)
    if (rows && rows != 0){
      res.render("accountAdmin",{dish, usages : [], accounts : [], success : 1});
    }
    else{
      res.render("accountAdmin",{dish,usages : [], accounts : [], success : 0});
    }    
  }

  if (action == 'usage'){
    const date = req.body.dateUsage
    const account = req.body.accountUsage
    const usages = await accountUsagePlan(account, date)
    res.render("accountAdmin",{dish, usages : usages, accounts : [], success : 3});
  }

  if (action == 'filter'){
    const plan = req.body.planFilter
    const date = req.body.dateFilter
    const accounts = await accountPlanDate(date, plan)
    res.render("accountAdmin",{dish, usages : [], accounts : accounts, success : 4});
  }

  if (action == 'sms'){
    const account = req.body.accountSMS
    const offers = await accountSmsOffers(account)
    res.render("accountAdmin",{dish, usages : [], accounts : [], offers : offers, success : 5});
  }

  if (action == 'cashback'){
    const plan = req.body.planCashback
    const wallet = req.body.walletCashback
    const cashback = await walletCashbackAmount(plan, wallet)
    res.render("accountAdmin",{dish, usages : [], accounts : [],cashback : cashback, success : 6});
  }

  if (action == 'transactions'){
    const wallet = req.body.walletTransactions
    const start = req.body.startTransactions
    const end = req.body.endTransactions
    const transactions = await averageSentTransactions(start, end, wallet)
    res.render("accountAdmin",{dish, usages : [], accounts : [], transactions: transactions, success : 7});
  }

  if (action == 'points'){
    const account = req.body.accountPoints
    const rows = await updatePoints(account)
    if (rows && rows > 0){
      res.render("accountAdmin",{dish, usages : [], accounts : [], success : 9});
    }
    else{
      res.render("accountAdmin",{dish, usages : [], accounts : [], success : 8});
    }
  }

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

  if (mobileNo == "1" && password == "hamoksha") {
    res.redirect("accountAdmin");
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


app.get("/benefits", async(req, res) => {
  const benefit = await activeBenefits();
  const dish = await cookData(currMobileNo);
  const name = dish.name.recordset[0].name;
  res.render("benefits",{benefit,currMobileNo,name});
});




app.get("/plans", async(req, res) => {
  const service = await allServicePlans();
  const unsub = await unsubscribedPlans(currMobileNo)
  let unsubIDs = []
  for (let i = 0; i < unsub.length; i++){
    unsubIDs.push(unsub[i].planID)
  }
  const dish = await cookData(currMobileNo);
  const name = dish.name.recordset[0].name;
  res.render("plans",{service,unsubIDs, name});
});


  
app.get("/wallet", async(req, res) => {
  const dish = await cookData(currMobileNo)
  res.render("wallet", {dish, success: 2});
});



app.post('/wallet', async (req, res) =>{
  let dish = await cookData(currMobileNo)
  try{
    const benefitID = req.body.benefitID
    const paymentID = req.body.paymentID
    const ree = await cashbackAccount(currMobileNo, paymentID, benefitID)
    console.log(ree)
    dish = await cookData(currMobileNo)
    console.log(ree)
    if(ree && ree > 0)
    {
      res.render("wallet", {dish, cashAcc: ree, success: 1});
    } else
    {
      res.render("wallet", {dish, cashAcc: ree, success: 0});
    }
    }
    catch (err){
      console.log(err)
      res.render("wallet", {dish, cashAcc: 0, success: 0});
    }
})



app.get("/renew", async(req, res) => {
  const dish = await cookData(currMobileNo)
  res.render("renew", {dish, name: dish.name.recordset[0].name, success : 2, extra: null, rem: null});
});

app.post("/renew", async(req, res) => {
  const action = req.body.action;
  const dish = await cookData(currMobileNo)

  if(action == 'recharge'){
    const amount = req.body.amount
  const method = req.body.method
  try{
    await balanceRecharge(currMobileNo, amount, method)

    res.render("renew", {dish,name: dish.name.recordset[0].name, success : 4 });
  }
  
  catch (err) {
    res.render("renew", {dish, name: dish.name.recordset[0].name, success : 3 });
  }
  
  }
  if(action == 'renew')
  {
  const amount = req.body.amount
  const method = req.body.method
  const plan = req.body.plan
  const rows = await renewPlan(currMobileNo, amount, method, plan)

  if (rows && rows != 0){
    res.render("renew", {dish,name: dish.name.recordset[0].name, success : 1, rem: null, extra: null});
  }
  else{
    res.render("renew", {dish, name: dish.name.recordset[0].name, success : 0, rem:null, extra:null});
  }

  }

  if (action == 'showDetails')
  {
    const planName = req.body.planname;
    const rem = await remAmount(planName)
    const extra = await extraAmount(planName)
    res.render("renew", {dish, name: dish.name.recordset[0].name, success : 2, rem: rem, extra:extra });
    
  }

  
});

app.get("/vouchers", async(req, res) => {
  const dish = await cookData(currMobileNo)
  res.render("vouchers", {dish, highest : dish.highestVoucher, name: dish.name.recordset[0].name, success : 2 });
});

app.post("/vouchers", async(req, res) => {
  var voucher = req.body.voucher
  const dish = await cookData(currMobileNo)
  var rows = await redeemVoucher(currMobileNo, voucher)
  if (rows && rows != 0){
    res.render("vouchers", {dish, highest : dish.highestVoucher, name: dish.name.recordset[0].name, success : 1 });
  }
  else{
    res.render("vouchers", {dish, highest : dish.highestVoucher, name: dish.name.recordset[0].name, success : 0 });
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
  } 
}

async function notResolvedTickets(mobileNumber) {

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
      
    if (result.recordset[0]) return result.recordset[0]
    else{
      return {}
    }
  
}

async function highestVoucher(mobileNumber) {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("mobile_num", sql.Char, mobileNumber)
      .execute("Account_Highest_Voucher");
    if (result.recordset[0]) return result.recordset[0].voucherID;
    else{
      console.log('null')
    }
    
  
}

async function remAmount(planName) {
  try {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("plan_name", sql.VarChar, planName)
      .input("mobile_num", sql.Char, currMobileNo)
      .query(
        "SELECT dbo.Remaining_plan_amount(@mobile_num, @plan_name) AS res"
      );
    return result.recordset[0].res;

  } catch (err) {
    console.error("Error querying the view:", err);
  } 
}


async function extraAmount(planName) {
  try {
    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("plan_name", sql.VarChar, planName)
      .input("mobile_num", sql.Char, currMobileNo)
      .query(
        "SELECT dbo.Extra_plan_amount(@mobile_num, @plan_name) AS res"
      );
    return result.recordset[0].res;
  } catch (err) {
    console.error("Error querying the view:", err);
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
  return result.rowsAffected[0]
};

const cashbackAccount = async (inputNum, payment_id, benefit_id) => {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, inputNum)
    .input("payment_id", sql.Int, payment_id)
    .input("benefit_id", sql.Int, benefit_id)
    .execute("Payment_wallet_cashback");
    return result.rowsAffected[0];
};

const balanceRecharge = async (inputNum, amount, payment_method) => {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, inputNum)
    .input("payment_method", sql.VarChar, payment_method)
    .input("amount", sql.Int, amount)
    .execute("Initiate_balance_payment");
  return result.rowsAffected[0]
  //view should update whenever this is called
};

const redeemVoucher = async (inputNum, v_id) => {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, inputNum)
    .input("voucher_id", sql.Int, v_id)
    .execute("Redeem_voucher_points");
  return result.rowsAffected[0]
};

// admin 1

//1-2
async function allCustomerAccounts() {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .query("SELECT * FROM allCustomerAccounts");
  return result.recordset;
}

//1-3
async function physicalStoreVouchers() {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .query("SELECT * FROM PhysicalStoreVouchers");
  return result.recordset;
}

//1-4
async function allResolvedTickets() {
  const pool = await sql.connect(config);
  const result = await pool.request().query("SELECT * FROM allResolvedTickets");
  return result.recordset;
}

//1-5
async function accountPlan() {
  const pool = await sql.connect(config);
  const result = await pool.request().execute("Account_Plan");
  return result.recordset;
}

//1-6
async function accountPlanDate(subDate, planId) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("sub_date", sql.Date, subDate)
    .input("plan_id", sql.Int, planId)
    .query("SELECT * FROM dbo.Account_Plan_Date(@sub_date,@plan_id)");
  return result.recordset;
}

//1-7
async function accountUsagePlan(mobileNum, startDate) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, mobileNum)
    .input("start_date", sql.Date, startDate)
    .query("SELECT * FROM dbo.Account_Usage_Plan(@mobile_num,@start_date)");
  return result.recordset;
}
//1-8
async function benefitsAccounts(mobileNum, planID) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, mobileNum)
    .input("plan_id", sql.Int, planID)
    .execute("Benefits_Account");
  return result.rowsAffected[0];
}

//1-9
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
  return result.recordset[0];
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
  return result.recordset[0].average;
}

async function walletLinked(number) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, number)
    .query("SELECT dbo.Wallet_MobileNo(@mobile_num) AS linked");
  return result.recordset[0].linked;
}

async function updatePoints(number) {
  const pool = await sql.connect(config);
  const result = await pool
    .request()
    .input("mobile_num", sql.Char, number)
    .execute("Total_Points_Account");
  return result.rowsAffected[2]
}

app.listen(3030);
// module.exports = app;
