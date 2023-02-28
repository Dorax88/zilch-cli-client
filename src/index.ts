import * as web3 from '@solana/web3.js'
import * as borsh from '@project-serum/borsh'
import * as fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()

function initializeSignerKeypair(): web3.Keypair {
    if (!process.env.PRIVATE_KEY) {
        console.log('Creating .env file')
        const signer = web3.Keypair.generate()
        fs.writeFileSync('.env',`PRIVATE_KEY=[${signer.secretKey.toString()}]`)
        return signer
    }

    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[]
    const secretKey = Uint8Array.from(secret)
    const keypairFromSecretKey = web3.Keypair.fromSecretKey(secretKey)
    return keypairFromSecretKey
}

async function airdropSolIfNeeded(signer: web3.Keypair, connection: web3.Connection) {
    const balance = await connection.getBalance(signer.publicKey)
    console.log('Current balance is', balance)
    if (balance < web3.LAMPORTS_PER_SOL) {
        console.log('Airdropping 1 SOL...')
        await connection.requestAirdrop(signer.publicKey, web3.LAMPORTS_PER_SOL)
    }
}

const zilchInstructionLayout = borsh.struct([
    borsh.u8('variant'),
    borsh.str('program_hash'),
    borsh.u8('outputs'),
    borsh.str('proof_account')
])

async function sendTestzilchReview(signer: web3.Keypair, programId: web3.PublicKey, connection: web3.Connection) {
    let buffer = Buffer.alloc(1000)
    const zilchprogram_hash = `Braveheart${Math.random()*1000000}`
    zilchInstructionLayout.encode(
        {
            variant: 0,
            program_hash: zilchprogram_hash,
            outputs: 5,
            proof_account: 'A great zilch'
        },
        buffer
    )

    buffer = buffer.slice(0, zilchInstructionLayout.getSpan(buffer))

    const [pda] = await web3.PublicKey.findProgramAddress(
        [signer.publicKey.toBuffer(), Buffer.from(zilchprogram_hash)],
        programId
    )

    console.log("PDA is:", pda.toBase58())

    const transaction = new web3.Transaction()

    const instruction = new web3.TransactionInstruction({
        programId: programId,
        data: buffer,
        keys: [
            {
                pubkey: signer.publicKey,
                isSigner: true,
                isWritable: false
            },
            {
                pubkey: pda,
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: web3.SystemProgram.programId,
                isSigner: false,
                isWritable: false
            }
        ]
    })

    transaction.add(instruction)
    const tx = await web3.sendAndConfirmTransaction(connection, transaction, [signer])
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`)
}

async function main() {
    const signer = initializeSignerKeypair()

    // const connection = new web3.Connection(web3.clusterApiUrl("devnet")) //changed to localnet
    const connection = new web3.Connection('http://127.0.0.1:8899')
    await airdropSolIfNeeded(signer, connection)

    const zilchProgramId = new web3.PublicKey('5m7eR6ZUsZkMfMp1KmiT3RXd6USQwPEDfeGnMgvRK5Yd') //custom.
    await sendTestzilchReview(signer, zilchProgramId, connection)
}

main().then(() => {
    console.log('Finished successfully')
    process.exit(0)
}).catch(error => {
    console.log(error)
    process.exit(1)
})
