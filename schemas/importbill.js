const mongoose = require('mongoose');

const importBillSchema = new mongoose.Schema({
    vendorName: {
        type: String,
        required: true
    },
    vendorAddress: {
        type: String,
        required: true
    },
    items: [{
        itemName: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        }
    }],
}, { timestamps: true });

const ImportBill = mongoose.model('ImportBill', importBillSchema);

module.exports = ImportBill;
