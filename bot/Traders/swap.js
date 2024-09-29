"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiSwap = void 0;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var axios_1 = require("axios");
var A0_1 = require("./A0");
var raydium_sdk_v2_1 = require("@raydium-io/raydium-sdk-v2");
var apiSwap = function () { return __awaiter(void 0, void 0, void 0, function () {
    var inputMint, outputMint, amount, slippage, txVersion, isV0Tx, _a, isInputSol, isOutputSol, tokenAccounts, inputTokenAcc, outputTokenAcc, data, swapResponse, swapTransactions, allTxBuf, allTransactions, idx, _i, allTransactions_1, tx, transaction, txId, _b, allTransactions_2, tx, transaction, txId, _c, lastValidBlockHeight, blockhash, data_1;
    var _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                inputMint = spl_token_1.NATIVE_MINT.toBase58();
                outputMint = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' // RAY
                ;
                amount = 5000000;
                slippage = 5 // in percent, for this example, 0.5 means 0.5%
                ;
                txVersion = 'V0' // or LEGACY
                ;
                isV0Tx = txVersion === 'V0';
                _a = [inputMint === spl_token_1.NATIVE_MINT.toBase58(), outputMint === spl_token_1.NATIVE_MINT.toBase58()], isInputSol = _a[0], isOutputSol = _a[1];
                return [4 /*yield*/, (0, A0_1.fetchTokenAccountData)()];
            case 1:
                tokenAccounts = (_f.sent()).tokenAccounts;
                inputTokenAcc = (_d = tokenAccounts.find(function (a) { return a.mint.toBase58() === inputMint; })) === null || _d === void 0 ? void 0 : _d.publicKey;
                outputTokenAcc = (_e = tokenAccounts.find(function (a) { return a.mint.toBase58() === outputMint; })) === null || _e === void 0 ? void 0 : _e.publicKey;
                if (!inputTokenAcc && !isInputSol) {
                    console.error('do not have input token account');
                    return [2 /*return*/];
                }
                return [4 /*yield*/, axios_1.default.get("".concat(raydium_sdk_v2_1.API_URLS.BASE_HOST).concat(raydium_sdk_v2_1.API_URLS.PRIORITY_FEE))];
            case 2:
                data = (_f.sent()).data;
                return [4 /*yield*/, axios_1.default.get("".concat(raydium_sdk_v2_1.API_URLS.SWAP_HOST, "/compute/swap-base-in?inputMint=").concat(inputMint, "&outputMint=").concat(outputMint, "&amount=").concat(amount, "&slippageBps=").concat(slippage * 100, "&txVersion=").concat(txVersion))]; // Use the URL xxx/swap-base-in or xxx/swap-base-out to define the swap type. 
            case 3:
                swapResponse = (_f.sent()) // Use the URL xxx/swap-base-in or xxx/swap-base-out to define the swap type. 
                .data;
                return [4 /*yield*/, axios_1.default.post("".concat(raydium_sdk_v2_1.API_URLS.SWAP_HOST, "/transaction/swap-base-in"), {
                        computeUnitPriceMicroLamports: String(data.data.default.h),
                        swapResponse: swapResponse,
                        txVersion: txVersion,
                        wallet: A0_1.owner.publicKey.toBase58(),
                        wrapSol: isInputSol,
                        unwrapSol: isOutputSol, // true means output mint receive sol, false means output mint received wsol
                        inputAccount: isInputSol ? undefined : inputTokenAcc === null || inputTokenAcc === void 0 ? void 0 : inputTokenAcc.toBase58(),
                        outputAccount: isOutputSol ? undefined : outputTokenAcc === null || outputTokenAcc === void 0 ? void 0 : outputTokenAcc.toBase58(),
                    })];
            case 4:
                swapTransactions = (_f.sent()).data;
                allTxBuf = swapTransactions.data.map(function (tx) { return Buffer.from(tx.transaction, 'base64'); });
                allTransactions = allTxBuf.map(function (txBuf) {
                    return isV0Tx ? web3_js_1.VersionedTransaction.deserialize(txBuf) : web3_js_1.Transaction.from(txBuf);
                });
                console.log("total ".concat(allTransactions.length, " transactions"), swapTransactions);
                idx = 0;
                if (!!isV0Tx) return [3 /*break*/, 9];
                _i = 0, allTransactions_1 = allTransactions;
                _f.label = 5;
            case 5:
                if (!(_i < allTransactions_1.length)) return [3 /*break*/, 8];
                tx = allTransactions_1[_i];
                console.log("".concat(++idx, " transaction sending..."));
                transaction = tx;
                transaction.sign(A0_1.owner);
                return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(A0_1.connection, transaction, [A0_1.owner], { skipPreflight: true })];
            case 6:
                txId = _f.sent();
                console.log("".concat(++idx, " transaction confirmed, txId: ").concat(txId));
                _f.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 5];
            case 8: return [3 /*break*/, 17];
            case 9:
                _b = 0, allTransactions_2 = allTransactions;
                _f.label = 10;
            case 10:
                if (!(_b < allTransactions_2.length)) return [3 /*break*/, 16];
                tx = allTransactions_2[_b];
                idx++;
                transaction = tx;
                transaction.sign([A0_1.owner]);
                return [4 /*yield*/, A0_1.connection.sendTransaction(tx, { skipPreflight: true })];
            case 11:
                txId = _f.sent();
                return [4 /*yield*/, A0_1.connection.getLatestBlockhash({
                        commitment: 'finalized',
                    })];
            case 12:
                _c = _f.sent(), lastValidBlockHeight = _c.lastValidBlockHeight, blockhash = _c.blockhash;
                console.log("".concat(idx, " transaction sending..., txId: ").concat(txId));
                return [4 /*yield*/, A0_1.connection.confirmTransaction({
                        blockhash: blockhash,
                        lastValidBlockHeight: lastValidBlockHeight,
                        signature: txId,
                    }, 'confirmed')];
            case 13:
                _f.sent();
                console.log("".concat(idx, " transaction confirmed"));
                return [4 /*yield*/, axios_1.default.get("".concat(raydium_sdk_v2_1.API_URLS.BASE_HOST).concat(raydium_sdk_v2_1.API_URLS.PRIORITY_FEE))];
            case 14:
                data_1 = (_f.sent()).data;
                _f.label = 15;
            case 15:
                _b++;
                return [3 /*break*/, 10];
            case 16:
                ("".concat(raydium_sdk_v2_1.API_URLS.SWAP_HOST, "/transaction/swap-base-in"));
                {
                    computeUnitPriceMicroLamports: String(data.data.default.h);
                }
                _f.label = 17;
            case 17: return [2 /*return*/];
        }
    });
}); }; // or custom lamport number.
exports.apiSwap = apiSwap;
apiSwap()
