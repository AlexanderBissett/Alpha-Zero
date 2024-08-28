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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTokenAccountData = exports.initSdk = exports.txVersion = exports.connection = exports.owner = void 0;
var raydium_sdk_v2_1 = require("@raydium-io/raydium-sdk-v2");
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var bs58_1 = require("bs58");
exports.owner = web3_js_1.Keypair.fromSecretKey(bs58_1.decode('3TFKHezScu2eA1yYnv4LTGYtJLG9rbBwaB3Uc3p6X8e4KxXyQVAhnxoevHUFg8MhkunoG6dsnYKwWMjhUtXq6nDv'));
exports.connection = new web3_js_1.Connection('https://api.mainnet-beta.solana.com'); //<YOUR_RPC_URL>
// export const connection = new Connection(clusterApiUrl('devnet')) //<YOUR_RPC_URL>
exports.txVersion = raydium_sdk_v2_1.TxVersion.V0; // or TxVersion.LEGACY
var cluster = 'mainnet'; // 'mainnet' | 'devnet'
var raydium;
var initSdk = function (params) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (raydium)
                    return [2 /*return*/, raydium];
                console.log("connect to rpc ".concat(exports.connection.rpcEndpoint, " in ").concat(cluster));
                return [4 /*yield*/, raydium_sdk_v2_1.Raydium.load({
                        owner: exports.owner,
                        connection: exports.connection,
                        cluster: cluster,
                        disableFeatureCheck: true,
                        disableLoadToken: !(params === null || params === void 0 ? void 0 : params.loadToken),
                        blockhashCommitment: 'finalized',
                        // urlConfigs: {
                        //   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
                        // },
                    })
                    /**
                     * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
                     * if you want to handle token account by yourself, set token account data after init sdk
                     * code below shows how to do it.
                     * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
                     */
                    /*
                    raydium.account.updateTokenAccount(await fetchTokenAccountData())
                    connection.onAccountChange(owner.publicKey, async () => {
                      raydium!.account.updateTokenAccount(await fetchTokenAccountData())
                    })
                    */
                ];
            case 1:
                raydium = _a.sent();
                /**
                 * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
                 * if you want to handle token account by yourself, set token account data after init sdk
                 * code below shows how to do it.
                 * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
                 */
                /*
                raydium.account.updateTokenAccount(await fetchTokenAccountData())
                connection.onAccountChange(owner.publicKey, async () => {
                  raydium!.account.updateTokenAccount(await fetchTokenAccountData())
                })
                */
                return [2 /*return*/, raydium];
        }
    });
}); };
exports.initSdk = initSdk;
var fetchTokenAccountData = function () { return __awaiter(void 0, void 0, void 0, function () {
    var solAccountResp, tokenAccountResp, token2022Req, tokenAccountData;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.connection.getAccountInfo(exports.owner.publicKey)];
            case 1:
                solAccountResp = _a.sent();
                return [4 /*yield*/, exports.connection.getTokenAccountsByOwner(exports.owner.publicKey, { programId: spl_token_1.TOKEN_PROGRAM_ID })];
            case 2:
                tokenAccountResp = _a.sent();
                return [4 /*yield*/, exports.connection.getTokenAccountsByOwner(exports.owner.publicKey, { programId: spl_token_1.TOKEN_2022_PROGRAM_ID })];
            case 3:
                token2022Req = _a.sent();
                tokenAccountData = (0, raydium_sdk_v2_1.parseTokenAccountResp)({
                    owner: exports.owner.publicKey,
                    solAccountResp: solAccountResp,
                    tokenAccountResp: {
                        context: tokenAccountResp.context,
                        value: __spreadArray(__spreadArray([], tokenAccountResp.value, true), token2022Req.value, true),
                    },
                });
                return [2 /*return*/, tokenAccountData];
        }
    });
}); };
exports.fetchTokenAccountData = fetchTokenAccountData;
