import config from "../config.json"
import config_swap_state_account from "../.account/swap_state_account.json"
import config_operator_wallet from "../.account/operator_wallet.json"
import { SystemProgram } from "@solana/web3.js" 

import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
// Get init 
describe("Initializing", () => {
  console.log("Init State!")
  const provider = anchor.AnchorProvider.env()
  // Configure client to use the provider.
  anchor.setProvider(provider);
  const programId = new anchor.web3.PublicKey(config["program_id"]);

  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/swap.json", "utf8")
  );
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, programId, provider);
  const swap_state_account = anchor.web3.Keypair.fromSecretKey(new Uint8Array(config_swap_state_account));

  const mint_pubkey = new anchor.web3.PublicKey(config["mint_token_account"]);
  const operator = anchor.web3.Keypair.fromSecretKey(new Uint8Array(config_operator_wallet));
  it("Init data to " + swap_state_account.publicKey.toBase58() + ":...", async () => {
    await program.rpc.initialize({
      accounts: {
        swapStateAccount: swap_state_account.publicKey,
        user: operator.publicKey,
        authority: operator.publicKey,
        mintAccount: mint_pubkey, 
        systemProgram: SystemProgram.programId,
      },
        signers: [swap_state_account]
      }); 
  }) 
});