const { deploy, getAccount, getContract} = require('@completium/completium-cli');

let nft;
const alice = getAccount( 'mainnet_temple');
const receiver = "tz1iLDFDyCumiMrTMUKDkBsHkcJKRjg9cw5W"
describe("Deploy contract", async () => {
    it("Deploy NFT contract", async () => {
        [nft, _] = await deploy("./contracts/transfer-lock-nft.arl", {
            parameters: {
                owner: alice.pkh,
            },
            named: "cannes_nft",
            metadata_uri: "ipfs://QmQbMqJ3d9wpBiMU9RfEBcd2cCRztyfBZCHUT4EGdWSSja",
            as: alice.pkh
        });
    });
});

describe("Contract configuration", async () => {
    it('Lock contract', async () => {
        await nft.lock({
            as: alice.pkh,
        });
    });
    // it("Load NFT", async () => {
    //     console.log("test")
    //     nft = await getContract("cannes_nft")
    //     console.log("test")
    //
    // });
    it('Set up tokens', async () => {
        //tickets
        // await nft.mint({
        //     arg: {
        //         itokenid: 0,
        //         iowner: receiver,
        //         itokenMetadata: [{ key: '', value: '0x697066733a2f2f6261666b72656967627666786b3461643761366232366534677077347676377a32766775746961346964716d6c327a716174326565637176767179' }],
        //         iamount: 55,
        //         iroyalties: [
        //             [receiver, 1500]
        //         ],
        //     },
        //     as: alice.pkh,
        // });
        //sales
        await nft.mint({
            arg: {
                itokenid: 0,
                iowner: receiver,
                itokenMetadata: [{ key: '', value: '0x697066733a2f2f6261666b72656966346e7033776b70656176696678787437326d67666a70796335326479756b707a646d756c706d737266786b6132676671623679' }],
                iamount: 105,
                iroyalties: [
                    [receiver, 1500]
                ],
            },
            as: alice.pkh,
        });
        //golden
        await nft.mint({
            arg: {
                itokenid: 1,
                iowner: receiver,
                itokenMetadata: [{ key: '', value: '0x697066733a2f2f6261666b72656967333733647a6f7878647764676e357067627277616a63336b6e37326174616b69703467776e626732356f7a6d6e783534643334' }],
                iamount: 2,
                iroyalties: [
                    [receiver, 1500]
                ],
            },
            as: alice.pkh,
        });
    });
});

