const {
    deploy,
    getAccount,
    getValueFromBigMap,
    setQuiet,
    expectToThrow,
    exprMichelineToJson,
    setMockupNow,
    getEndpoint
} = require('@completium/completium-cli');
const {
    errors,
    mkTransferPermit,
    mkApproveForAllSingle,
    mkDeleteApproveForAllSingle,
    mkTransferGaslessArgs
} = require('./utils');
const assert = require('assert');

require('mocha/package.json');
const mochaLogger = require('mocha-logger');

setQuiet('true');

const mockup_mode = true;

// contracts
let fa2;

// accounts
const alice = getAccount(mockup_mode ? 'alice' : 'alice');
const bob = getAccount(mockup_mode ? 'bob' : 'bob');
const carl = getAccount(mockup_mode ? 'carl' : 'carl');
const daniel = getAccount(mockup_mode ? 'daniel' : 'daniel');

const amount = 100;
let tokenId = 0;

describe('Contract deployment', async () => {
    it('FA2 private collection contract deployment should succeed', async () => {
        [fa2, _] = await deploy(
            './contracts/transfer-lock-nft.arl',
            {
                parameters: {
                    owner: bob.pkh,
                },
                as: bob.pkh,
            }
        );
    });
});

describe('Set metadata', async () => {
    it('Set metadata with empty content should succeed', async () => {
        const argM = `(Pair "key" 0x)`;
        const storage = await fa2.getStorage();
        await fa2.set_metadata({
            argMichelson: argM,
            as: bob.pkh,
        });
        var metadata = await getValueFromBigMap(
            parseInt(storage.metadata),
            exprMichelineToJson(`""`),
            exprMichelineToJson(`string'`)
        );
        assert(metadata.bytes == '');
    });

    it('Set metadata called by not owner should fail', async () => {
        await expectToThrow(async () => {
            const argM = `(Pair "key" 0x)`;
            await fa2.set_metadata({
                argMichelson: argM,
                as: alice.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Set metadata with valid content should succeed', async () => {
        const bytes =
            '0x05070707070a00000016016a5569553c34c4bfe352ad21740dea4e2faad3da000a00000004f5f466ab070700000a000000209aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc';
        const argM = `(Pair "" ${bytes})`;
        const storage = await fa2.getStorage();

        await fa2.set_metadata({
            argMichelson: argM,
            as: bob.pkh,
        });

        var metadata = await getValueFromBigMap(
            parseInt(storage.metadata),
            exprMichelineToJson(`""`),
            exprMichelineToJson(`string'`)
        );
        assert('0x' + metadata.bytes == bytes);
    });
});

describe('Set owner', async () => {
    it('Set owner called by not owner should fail', async () => {
        await expectToThrow(async () => {
            await fa2.set_owner({
                argMichelson: `"${bob.pkh}"`,
                as: alice.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Set owner with valid caller should succeed', async () => {
        const pre_storage = await fa2.getStorage();

        assert(pre_storage.owner == bob.pkh);

        await fa2.set_owner({
            argMichelson: `"${alice.pkh}"`,
            as: bob.pkh,
        });
        const post_storage = await fa2.getStorage();

        assert(post_storage.owner == alice.pkh);
    });
});

describe('Lock/Unlock', async () => {
    it('Lock called by not owner should fail', async () => {
        await expectToThrow(async () => {
            await fa2.lock({
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Lock called by owner should succeed', async () => {
        const pre_storage = await fa2.getStorage();

        assert(pre_storage.is_locked == false);

        await fa2.lock({
            as: alice.pkh,
        });
        const post_storage = await fa2.getStorage();

        assert(post_storage.is_locked == true);
    });

    it('Unlock called by not owner should fail', async () => {
        await expectToThrow(async () => {
            await fa2.unlock({
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Unlock called by owner should succeed', async () => {
        const pre_storage = await fa2.getStorage();

        assert(pre_storage.is_locked == true);

        await fa2.unlock({
            as: alice.pkh,
        });
        const post_storage = await fa2.getStorage();

        assert(post_storage.is_locked == false);
    });
});

describe('Authorize/Remove authorization', async () => {
    it('Authorize called by not owner should fail', async () => {
        await expectToThrow(async () => {
            await fa2.authorize({
                argMichelson: `"${alice.pkh}"`,
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Authorize called by owner should succeed', async () => {
        const pre_storage = await fa2.getStorage();

        assert(pre_storage.authorized_addresses.length == 0);

        await fa2.authorize({
            argMichelson: `"${carl.pkh}"`,
            as: alice.pkh,
        });
        const post_storage = await fa2.getStorage();

        assert(post_storage.authorized_addresses.length == 1 && post_storage.authorized_addresses.includes(carl.pkh));
    });

    it('Remove authorization called by not owner should fail', async () => {
        await expectToThrow(async () => {
            await fa2.remove_authorization({
                argMichelson: `"${carl.pkh}"`,
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Remove authorization called by owner should succeed', async () => {
        const pre_storage = await fa2.getStorage();

        assert(pre_storage.authorized_addresses.length == 1 && pre_storage.authorized_addresses.includes(carl.pkh));

        await fa2.remove_authorization({
            argMichelson: `"${carl.pkh}"`,
            as: alice.pkh,
        });
        const post_storage = await fa2.getStorage();

        assert(post_storage.authorized_addresses.length == 0);
    });
});


describe('Minting', async () => {
    it('Mint tokens on FA2 Private collection contract as owner for ourself should succeed', async () => {
        await fa2.mint({
            arg: {
                itokenid: tokenId,
                iowner: alice.pkh,
                iamount: amount,
                itokenMetadata: [{key: '', value: '0x'}],
                iroyalties: [
                    [alice.pkh, 1000],
                    [bob.pkh, 500],
                ],
            },
            as: alice.pkh,
        });
        const storage = await fa2.getStorage();
        var balance = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address)'`)
        );
        assert(parseInt(balance.int) == amount);
    });

    it('Mint tokens on FA2 Private collection contract as non owner for ourself should fail', async () => {
        await expectToThrow(async () => {
            await fa2.mint({
                arg: {
                    itokenid: tokenId + 1,
                    iowner: bob.pkh,
                    iamount: amount,
                    itokenMetadata: [{key: '', value: '0x'}],
                    iroyalties: [
                        [alice.pkh, 1000],
                        [bob.pkh, 500],
                    ],
                },
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Mint tokens on FA2 Private collection contract as non owner for someone else should fail', async () => {
        await expectToThrow(async () => {
            await fa2.mint({
                arg: {
                    itokenid: tokenId + 2,
                    iowner: carl.pkh,
                    iamount: amount,
                    itokenMetadata: [{key: '', value: '0x'}],
                    iroyalties: [
                        [alice.pkh, 1000],
                        [bob.pkh, 500],
                    ],
                },
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Mint tokens on FA2 Private collection contract as owner for someone else should succeed', async () => {
        await fa2.mint({
            arg: {
                itokenid: tokenId + 3,
                iowner: carl.pkh,
                iamount: amount,
                itokenMetadata: [{key: '', value: '0x'}],
                iroyalties: [
                    [alice.pkh, 1000],
                    [bob.pkh, 500],
                ],
            },
            as: alice.pkh,
        });
        const storage = await fa2.getStorage();
        var balance = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId + 3} "${carl.pkh}")`),
            exprMichelineToJson(`(pair nat address)'`)
        );
        assert(parseInt(balance.int) == amount);
    });

    it('Re-Mint tokens on FA2 Private collection contract should fail', async () => {
        await expectToThrow(async () => {
            await fa2.mint({
                arg: {
                    itokenid: tokenId,
                    iowner: alice.pkh,
                    iamount: amount,
                    itokenMetadata: [{key: '', value: '0x'}],
                    iroyalties: [
                        [alice.pkh, 1000],
                        [bob.pkh, 500],
                    ],
                },
                as: alice.pkh,
            });
        }, errors.TOKEN_METADATA_KEY_EXISTS);
    });
});

describe('Update operators', async () => {
    it('Add an operator for ourself should succeed', async () => {
        const storage = await fa2.getStorage();
        var initialOperators = await getValueFromBigMap(
            parseInt(storage.operators),
            exprMichelineToJson(
                `(Pair "${fa2.address}" (Pair ${tokenId} "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        assert(initialOperators == null);
        await fa2.update_operators({
            argMichelson: `{Left (Pair "${alice.pkh}" "${fa2.address}" ${tokenId})}`,
            as: alice.pkh,
        });
        var operatorsAfterAdd = await getValueFromBigMap(
            parseInt(storage.operators),
            exprMichelineToJson(
                `(Pair "${fa2.address}" (Pair ${tokenId} "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        assert(operatorsAfterAdd.prim == 'Unit');
    });

    it('Remove a non existing operator should succeed', async () => {
        await fa2.update_operators({
            argMichelson: `{Right (Pair "${alice.pkh}" "${bob.pkh}" ${tokenId})}`,
            as: alice.pkh,
        });
    });

    it('Remove an existing operator for another user should fail', async () => {
        await expectToThrow(async () => {
            await fa2.update_operators({
                argMichelson: `{Right (Pair "${alice.pkh}" "${fa2.address}" ${tokenId})}`,
                as: bob.pkh,
            });
        }, errors.CALLER_NOT_OWNER);
    });

    it('Add operator for another user should fail', async () => {
        await expectToThrow(async () => {
            await fa2.update_operators({
                argMichelson: `{Left (Pair "${bob.pkh}" "${fa2.address}" ${tokenId})}`,
                as: alice.pkh,
            });
        }, errors.CALLER_NOT_OWNER);
    });

    it('Remove an existing operator should succeed', async () => {
        const storage = await fa2.getStorage();
        var initialOperators = await getValueFromBigMap(
            parseInt(storage.operators),
            exprMichelineToJson(
                `(Pair "${fa2.address}" (Pair ${tokenId} "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        assert(initialOperators.prim == 'Unit');
        await fa2.update_operators({
            argMichelson: `{Right (Pair "${alice.pkh}" "${fa2.address}" ${tokenId})}`,
            as: alice.pkh,
        });
        var operatorsAfterRemoval = await getValueFromBigMap(
            parseInt(storage.operators),
            exprMichelineToJson(
                `(Pair "${fa2.address}" (Pair ${tokenId} "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        assert(operatorsAfterRemoval == null);
    });
});

describe('Update operators for all', async () => {
    it('Add an operator for all for ourself should succeed', async () => {
        const storage = await fa2.getStorage();
        var initialOperators = await getValueFromBigMap(
            parseInt(storage.operators_for_all),
            exprMichelineToJson(
                `(Pair "${fa2.address}" "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address address)'`)
        );
        assert(initialOperators == null);
        await fa2.update_operators_for_all({
            argJsonMichelson: mkApproveForAllSingle(fa2.address),
            as: alice.pkh
        });
        var operatorsAfterAdd = await getValueFromBigMap(
            parseInt(storage.operators_for_all),
            exprMichelineToJson(
                `(Pair "${fa2.address}" "${alice.pkh}")`
            ),
            exprMichelineToJson(`(pair address address)'`)
        );
        assert(operatorsAfterAdd.prim == 'Unit');
    });

    it('Remove a non existing operator should succeed', async () => {
        await fa2.update_operators_for_all({
            argJsonMichelson: mkDeleteApproveForAllSingle(bob.pkh),
            as: alice.pkh
        });
    });

    it('Remove an existing operator should succeed', async () => {
        const storage = await fa2.getStorage();
        var initialOperators = await getValueFromBigMap(
            parseInt(storage.operators_for_all),
            exprMichelineToJson(
                `(Pair "${fa2.address}" "${alice.pkh}")`
            ),
            exprMichelineToJson(`(pair address address)'`)
        );
        assert(initialOperators.prim == "Unit");
        await fa2.update_operators_for_all({
            argJsonMichelson: mkDeleteApproveForAllSingle(fa2.address),
            as: alice.pkh
        });
        var operatorsAfterRemoval = await getValueFromBigMap(
            parseInt(storage.operators_for_all),
            exprMichelineToJson(
                `(Pair "${fa2.address}" "${alice.pkh}")`
            ),
            exprMichelineToJson(`(pair address address)'`)
        );
        assert(operatorsAfterRemoval == null);
    });
});

describe('Transfers', async () => {
    it('Transfer a token when contract is locked should fail', async () => {
        await expectToThrow(async () => {
            await fa2.lock({
                as: alice.pkh
            });
            await fa2.transfer({
                arg: {
                    txs: [[carl.pkh, [[bob.pkh, tokenId + 3, 1]]]],
                },
                as: carl.pkh,
            });
        }, errors.TRANSFER_NOT_AUTHORIZED);
    });

    it('Transfer a token when contract is locked as authorized address (without operator) should fail', async () => {
        await expectToThrow(async () => {
            await fa2.authorize({
                argMichelson: `"${bob.pkh}"`,
                as: alice.pkh
            });
            await fa2.transfer({
                arg: {
                    txs: [[carl.pkh, [[bob.pkh, tokenId + 3, 1]]]],
                },
                as: bob.pkh,
            });
        }, errors.FA2_NOT_OPERATOR);
    });

    it('Transfer a token when contract is locked as authorized address (with operator) should succeed', async () => {
        await fa2.update_operators({
            argMichelson: `{Left (Pair "${carl.pkh}" "${bob.pkh}" ${tokenId + 3})}`,
            as: carl.pkh,
        });
        const storage = await fa2.getStorage();

        var operatorsAfterAdd = await getValueFromBigMap(
            parseInt(storage.operators),
            exprMichelineToJson(
                `(Pair "${bob.pkh}" (Pair ${tokenId+3} "${carl.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        await fa2.transfer({
            arg: {
                txs: [[carl.pkh, [[bob.pkh, tokenId + 3, 1]]]],
            },
            as: bob.pkh,
        });
        await fa2.unlock({
            as: alice.pkh
        });
    });

    it('Transfer a token not owned should fail', async () => {
        await expectToThrow(async () => {
            await fa2.transfer({
                arg: {
                    txs: [[alice.pkh, [[bob.pkh, 666, 1]]]],
                },
                as: alice.pkh,
            });
        }, errors.FA2_NOT_OPERATOR);
    });

    it('Transfer a token from another user without a permit or an operator should fail', async () => {
        await expectToThrow(async () => {
            await fa2.transfer({
                arg: {
                    txs: [[alice.pkh, [[bob.pkh, tokenId, 1]]]],
                },
                as: bob.pkh,
            });
        }, errors.FA2_NOT_OPERATOR);
    });

    it('Transfer more tokens that owned should fail', async () => {
        await expectToThrow(async () => {
            await fa2.transfer({
                arg: {
                    txs: [[alice.pkh, [[bob.pkh, tokenId, 666]]]],
                },
                as: alice.pkh,
            });
        }, errors.FA2_INSUFFICIENT_BALANCE);
    });
});

describe('Burn', async () => {
    it('Burn without tokens should fail', async () => {
        await expectToThrow(async () => {
            await fa2.burn({
                argMichelson: `(Pair ${tokenId} 1))`,
                as: daniel.pkh,
            });
        }, errors.FA2_INSUFFICIENT_BALANCE);
    });

    it('Burn tokens with not enough tokens should fail', async () => {
        await expectToThrow(async () => {
            await fa2.burn({
                argMichelson: `(Pair ${tokenId} 666)`,
                as: alice.pkh,
            });
        }, errors.FA2_INSUFFICIENT_BALANCE);
    });

    it('Burn tokens with enough tokens should succeed', async () => {
        const test_tokenid = tokenId + 111
        await fa2.mint({
            arg: {
                itokenid: test_tokenid,
                iowner: alice.pkh,
                iamount: amount,
                itokenMetadata: [{key: '', value: '0x'}],
                iroyalties: [
                    [alice.pkh, 1000],
                    [bob.pkh, 500],
                ],
            },
            as: alice.pkh,
        });
        const storage = await fa2.getStorage();
        const burnAmount = 2;
        var aliceTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${test_tokenid} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(
            parseInt(aliceTransferBalances.int) == amount
        );
        await fa2.burn({
            argMichelson: `(Pair ${test_tokenid} ${burnAmount}))`,
            as: alice.pkh,
        });

        var alicePostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${test_tokenid} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(alicePostTransferBalances.int == "" + (amount - burnAmount));
    });

    it('Burn tokens with enough tokens and with operator a second time should succeed', async () => {
        const test_tokenid = tokenId + 112

        await fa2.mint({
            arg: {
                itokenid: test_tokenid,
                iowner: alice.pkh,
                iamount: amount,
                itokenMetadata: [{key: '', value: '0x'}],
                iroyalties: [
                    [alice.pkh, 1000],
                    [bob.pkh, 500],
                ],
            },
            as: alice.pkh,
        });

        const storage = await fa2.getStorage();
        var aliceTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${test_tokenid} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(
            parseInt(aliceTransferBalances.int) == amount
        );
        await fa2.burn({
            argMichelson: `(Pair ${test_tokenid} ${amount})`,
            as: alice.pkh,
        });

        var alicePostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${test_tokenid} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(alicePostTransferBalances == null);
    });
});