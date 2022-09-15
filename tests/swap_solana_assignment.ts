import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import {SystemProgram,SYSVAR_RENT_PUBKEY, SYSVAR_RECENT_BLOCKHASHES_PUBKEY, clusterApiUrl, Connection,PublicKey,AccountMeta, LAMPORTS_PER_SOL,Message } from "@solana/web3.js" 
import {createMint,getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, mintTo, Account } from '@solana/spl-token';
import config_operator_test_wallet from "../.account/operator_test_wallet.json"
import config from "../config.json"
const NULL_ADDRESS = new PublicKey("dead111111111111111111111111111111111111111");
const TOKEN_E9 = 1000000000;
const token_program_pubkey = new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
const associated_token_program_pubkey = new anchor.web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

describe("Testing", () => {
  // INIT
  const connection = new Connection(
    clusterApiUrl('testnet'),
    'confirmed'
  );
const programId = new anchor.web3.PublicKey(config["program_id"]);

const idl = JSON.parse(
  require("fs").readFileSync("./target/idl/swap.json", "utf8")
);
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, programId, provider);
 
  
  const operator = anchor.web3.Keypair.fromSecretKey(new Uint8Array(config_operator_test_wallet));
  const swap_state_account = anchor.web3.Keypair.generate();
  const userTest = anchor.web3.Keypair.generate();
  
  // Init for Token Account
  let from_tokens: Account;
  let to_tokens: Account;
  let mint_pubkey: anchor.web3.PublicKey;
  let pda_accounts: [anchor.web3.PublicKey, number];
  
  it("Requesting Airdrop:...", async () => {
    const airdropSignature = await connection.requestAirdrop(
      userTest.publicKey,
      LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(airdropSignature);
  })

  it("Init state to " + swap_state_account.publicKey + " and Init Token:...", async () => {
    mint_pubkey = 
      await createMint(
      connection,
      operator,
      operator.publicKey,
      operator.publicKey, // can be null
      9,
    );
    await program.rpc.initialize(
    {
      accounts: {
        swapStateAccount: swap_state_account.publicKey,
        user: operator.publicKey,
        authority: operator.publicKey,
        mintAccount: mint_pubkey, 
        systemProgram: SystemProgram.programId,
      },
        signers: [swap_state_account]
      });
    console.log("\tSwap State:" + swap_state_account.publicKey.toBase58());
    console.log("\tMint Pubkey: ", mint_pubkey.toBase58());
  });

  it("Mint 100000000000 Tokens to Program Wallet And create associate token accounts:...", async () => {
    pda_accounts = await PublicKey.findProgramAddress(
      [Buffer.from("token_holder")],
      programId
    );
    
    to_tokens = await getOrCreateAssociatedTokenAccount(
      connection,
      operator,
      mint_pubkey,
      pda_accounts[0],
      true
    );
    await mintTo(
      connection,
      operator,
      mint_pubkey,
      to_tokens.address,
      operator,
      100000000000 * TOKEN_E9
    );
  });

  it("Swaping 0.1 Sol to get 1 Token (Rate 1SOL = 10Token):...", async () => {
    pda_accounts = await PublicKey.findProgramAddress(
      [Buffer.from("token_holder")],
      programId
    );
    let from_token_swap_sol_to_token = await getOrCreateAssociatedTokenAccount(
          connection,
          operator,
          mint_pubkey,
          pda_accounts[0],
          true
    );
    let to_token_swap_sol_to_token =  await getAssociatedTokenAddress(
      mint_pubkey,
      userTest.publicKey
    );
    // Swap 0.1 Sol to get 1 Token
    const amount = new anchor.BN(LAMPORTS_PER_SOL / 10)

    const tx = await program.rpc.swap(
      amount,
      true,
      {
        accounts: {
          user: userTest.publicKey,
          swapStateAccount: swap_state_account.publicKey,
          fromTokens: from_token_swap_sol_to_token.address,
          toTokens: to_token_swap_sol_to_token,
          mintAccount: mint_pubkey,
          pdaAccount: pda_accounts[0],
          tokenProgram: token_program_pubkey,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: associated_token_program_pubkey,
          rent: SYSVAR_RENT_PUBKEY,
          programId: programId,
        }, 
        signers: [userTest],
      });
      console.log("Swap State Success. TxHash: " + tx);
  })
  it("Swaping 0.5 Token to get 0.05 Sol:...", async () => {
    pda_accounts = await PublicKey.findProgramAddress(
      [Buffer.from("token_holder")],
      programId
    );
    let from_token_swap_token_to_sol = await getOrCreateAssociatedTokenAccount(
          connection,
          operator,
          mint_pubkey,
          userTest.publicKey
    );
    let to_token_swap_token_to_sol = await getOrCreateAssociatedTokenAccount(
      connection,
      operator,
      mint_pubkey,
      pda_accounts[0],
      true
  );
  // Swap 0.5 Token to get 0.05 Sol
  const amount = new anchor.BN(TOKEN_E9 / 2)
  const tx = await program.rpc.swap(
      amount,
      false,
      {
        accounts: {
          user: userTest.publicKey,
          swapStateAccount: swap_state_account.publicKey,
          fromTokens: from_token_swap_token_to_sol.address,
          toTokens: to_token_swap_token_to_sol.address,
          mintAccount: mint_pubkey,
          pdaAccount: pda_accounts[0],
          tokenProgram: token_program_pubkey,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: associated_token_program_pubkey,
          rent: SYSVAR_RENT_PUBKEY,
          programId: programId,
        }, 
        signers: [userTest],
      });
    
      console.log("Swap Token to Sol Success. TxHash: " + tx);
  })
})