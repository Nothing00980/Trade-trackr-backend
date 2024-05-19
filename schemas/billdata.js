const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define schema for bill details
const BillDetailSchema = new Schema({
    description: String,
    quantity: Number,
    rate: Number,
    amount: Number
});

const UserBillSchema = new Schema({
  
    vendorname: {
        type: String,
        required: true
    },
    invoiceDate: {
        type: Date,
        default: Date.now
    },
    billDetails: [BillDetailSchema]
});

function getUserBillModel(userId) {
    // Define model for user bill
    return mongoose.model(`UserBill_${userId}`, UserBillSchema);
}



module.exports = getUserBillModel;