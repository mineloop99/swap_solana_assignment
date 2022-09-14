import * as anchor from "@project-serum/anchor";
import './App.css'; 
import { Connection, SystemProgram, clusterApiUrl, PublicKey, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorProvider, Program } from '@project-serum/anchor'; 
import address_config from './address_config.json'
import { getAssociatedTokenAddress } from "@solana/spl-token";
import idls from "./idls/idl.json";
import { useState } from 'react'; 
// For "Property 'solana' does not exist on type 'Window & typeof globalThis'" error.
interface Window {
  solana: any
}
declare let window: Window; 
function App() {
  async function getProvider() {
    const network = "https://explorer-api.testnet.solana.com";
    const connection = new Connection(network, "processed");
    const wallet = window.solana;

    const provider = new AnchorProvider(
      connection, wallet, {
        preflightCommitment: "recent",
        commitment: "confirmed",
      },
    );
    return provider;
  }
  const [amount, setAmount] = useState("0");
  const [amountToken, setAmountToken] = useState("0");
  const [isUseSol, setIsUseSol] = useState(true); 
  const [txHash, setTxHash] = useState("this is transaction hash");
  const [userAddress, setUserAddress] = useState("userAddress"); 
  const idl = JSON.parse(
    JSON.stringify(idls)
  );
  const connectWallet = async () => {
  try {
      const resp = await window.solana.connect();
      console.log("Conneted! Public Key: ", resp.publicKey.toString());
      setUserAddress(resp.publicKey.toString())
  } catch (err) {
      console.log(err);
      // => { code: 4001, message: 'User rejected the request.' }
  }
}; 

const disconnectWallet = async () => {
  window.solana.disconnect();
  window.solana.on('disconnect', () => console.log("Disconnected!"));
  setUserAddress("Disconected!")
};

  
  const sendTransaction = async (event: any) => {
    event.preventDefault();
    const provider = await getProvider(); 
    const programId = new anchor.web3.PublicKey(address_config.program_id);
    const program = new Program(idl, programId, provider);
    const wallet = window.solana;
    const pda_accounts = new anchor.web3.PublicKey(address_config.pda_account);
    const mint_pubkey = new PublicKey(address_config.mint_token_account);
    const swap_state_account= new PublicKey(address_config.swap_state);
    const token_program= new PublicKey(address_config.token_program);
    const associate_token_program=new PublicKey(address_config.associate_token_program);

    let realAmount = Number(amountToken) * Math.pow(10, 9);
    let amount_swap = new anchor.BN(realAmount);
    let from_token = await getAssociatedTokenAddress(
      mint_pubkey,
      wallet.publicKey
    );
    let to_token = await getAssociatedTokenAddress(
      mint_pubkey,
      pda_accounts,
      true
    );
    if (isUseSol) {
      from_token = await getAssociatedTokenAddress(
        mint_pubkey,
        pda_accounts,
        true
      );
      to_token = await getAssociatedTokenAddress(
        mint_pubkey,
        wallet.publicKey
      );
      realAmount = Number(amount) * LAMPORTS_PER_SOL;
      amount_swap = new anchor.BN(realAmount);
    }
    console.log("wallet: ", wallet.publicKey.toBase58());
    console.log("swap_state_account: ", swap_state_account.toBase58());
    console.log("from_token: ", from_token.toBase58());
    console.log("to_token: ", to_token.toBase58());
    console.log("mint_pubkey: ", mint_pubkey.toBase58());
    console.log("pda_accounts: ", pda_accounts.toBase58());
    console.log("token_program: ", token_program.toBase58());
    console.log("SystemProgram.programId: ", SystemProgram.programId.toBase58());
    console.log("associate_token_program: ", associate_token_program.toBase58());
    console.log("SYSVAR_RENT_PUBKEY: ", SYSVAR_RENT_PUBKEY.toBase58());
    console.log("programId: ", programId.toBase58());

    const tx =  await program.methods.swap(
      amount_swap,
      isUseSol).accounts( {
          user: wallet.publicKey,
          swapStateAccount: swap_state_account,
          fromTokens: from_token,
          toTokens: to_token,
          mintAccount: mint_pubkey,
          pdaAccount: pda_accounts,
          tokenProgram: token_program,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: associate_token_program,
          rent: SYSVAR_RENT_PUBKEY,
          programId: programId,
        }).rpc();
      setTxHash(tx);
      console.log(tx);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h3>Connect wallet before swap</h3>
        <h5>Address: {userAddress}</h5>
        <button onClick={connectWallet}>Connect to Wallet</button>
        <button onClick={disconnectWallet}>Disconnect</button> 
        
        <h3> Swap Sol To Token</h3>
        <form onSubmit={
            (e) =>
             {
              setIsUseSol(true);
              sendTransaction(e);
          }}>
            <label>Enter sol amount: <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <input type="submit" />
          </form>
          <h3> Or Swap Token To Sol</h3>
          <form onSubmit={
            (e) =>
             {
              setIsUseSol(false);
              sendTransaction(e);
          }}>
            <label>Enter token amount:  <input 
                type="number" 
                value={amountToken}
                onChange={(e) => {setAmountToken(e.target.value)}}
              />
            </label>
            <input type="submit" />
          </form>
          <h6>TxHash: {txHash}</h6>
      </header> 
    </div>
  );
}

export default App;