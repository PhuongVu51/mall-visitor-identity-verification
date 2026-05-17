"use client";

import { useState } from "react";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import contractABI from "../constants/contractABI.json";

export default function Home() {
  const [identity, setIdentity] = useState("");
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState<any>(null);

  // SEARCH STATES
  const [searchAddress, setSearchAddress] = useState("");
  const [resultHash, setResultHash] = useState("");
  const [resultTimestamp, setResultTimestamp] =
    useState("");

  // CONTRACT ADDRESS (Dán địa chỉ mới sau khi chạy lệnh deploy vào đây)
  const contractAddress =
    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  // CONNECT WALLET
  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatus("❌ MetaMask not detected");
        return;
      }

      const provider =
        new ethers.BrowserProvider(
          window.ethereum
        );

      const accounts = await provider.send(
        "eth_requestAccounts",
        []
      );

      const signer =
        await provider.getSigner();

      const deployedContract =
        new ethers.Contract(
          contractAddress,
          contractABI.abi,
          signer
        );

      setAccount(accounts[0]);
      setContract(deployedContract);

      setStatus(
        "✅ Wallet connected successfully"
      );
    } catch (err: any) {
      console.error(err);

      setStatus(
        "❌ Wallet connection failed"
      );
    }
  }

  // REGISTER IDENTITY
  async function registerIdentity() {
    try {
      if (!contract) {
        setStatus("❌ Contract not loaded");
        return;
      }

      if (!identity.trim()) {
        setStatus(
          "❌ Please enter identity"
        );
        return;
      }

      // HASH DATA
      const identityHash =
        "0x" +
        CryptoJS.SHA256(identity).toString();

      console.log(
        "Generated Hash:",
        identityHash
      );

      // SEND TRANSACTION
      const tx =
        await contract.registerIdentity(
          identityHash
        );

      setStatus(
        "⏳ Waiting for transaction..."
      );

      await tx.wait();

      setStatus(
        "✅ Identity registered successfully"
      );

      setIdentity("");
    } catch (err: any) {
      console.error(err);

      setStatus(
        "❌ Transaction failed: " +
          (err.reason || err.message)
      );
    }
  }

  // FETCH IDENTITY
  async function fetchIdentity() {
    try {
      if (!contract) {
        setStatus("❌ Contract not loaded");
        return;
      }

      if (!searchAddress.trim()) {
        setStatus(
          "❌ Please enter wallet address"
        );
        return;
      }

      // VALIDATE ADDRESS
      if (
        !ethers.isAddress(searchAddress)
      ) {
        setStatus(
          "❌ Invalid wallet address"
        );
        return;
      }

      // RESET OLD DATA
      setResultHash("");
      setResultTimestamp("");

      // GET DATA (Nhận về cả chuỗi Hash và mốc thời gian từ block)
      const data =
        await contract.getIdentity(
          searchAddress
        );

      console.log("Blockchain Data:", data);

      const hash = data[0];
      const timestamp = Number(data[1]);

      // NO DATA
      if (!hash || hash === "" || timestamp === 0) {
        setStatus(
          "❌ No identity found"
        );
        return;
      }

      setResultHash(hash);

      // CHUYỂN ĐỔI SANG NGÀY GIỜ THỰC TẾ
      const date = new Date(
        timestamp * 1000
      );
      setResultTimestamp(
        date.toLocaleString()
      );

      setStatus(
        "✅ Identity fetched successfully"
      );
    } catch (err: any) {
      console.error(err);

      setStatus(
        "❌ Fetch failed: " +
          (err.reason || err.message)
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-10">
      <h1 className="text-4xl font-bold mb-2">
        🔐 Blockchain Identity Verification
      </h1>

      <p className="mb-6 text-gray-600">
        Securely register your identity on
        Ethereum
      </p>

      {!account ? (
        <button
          onClick={connectWallet}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg"
        >
          Connect Wallet
        </button>
      ) : (
        <p className="mb-4 break-all text-center">
          Connected Wallet:
          <br />
          {account}
        </p>
      )}

      <div className="bg-white p-6 rounded-xl shadow-lg w-[400px]">

        {/* REGISTER */}
        <input
          type="text"
          placeholder="Enter your identity"
          className="border w-full p-3 rounded mb-4"
          value={identity}
          onChange={(e) =>
            setIdentity(e.target.value)
          }
        />

        <button
          onClick={registerIdentity}
          className="bg-green-500 text-white w-full py-3 rounded-lg mb-6 hover:bg-green-600"
        >
          Register Identity
        </button>

        {/* SEARCH */}
        <input
          type="text"
          placeholder="Enter wallet address"
          className="border w-full p-3 rounded mb-4"
          value={searchAddress}
          onChange={(e) =>
            setSearchAddress(
              e.target.value
            )
          }
        />

        <button
          onClick={fetchIdentity}
          className="bg-purple-500 text-white w-full py-3 rounded-lg hover:bg-purple-600"
        >
          Get Identity
        </button>

        {/* RESULT */}
        {resultHash && (
          <div className="mt-6 border p-4 rounded bg-gray-50">
            <p className="font-bold mb-2">
              Identity Hash:
            </p>

            <p className="break-all text-sm">
              {resultHash}
            </p>

            <p className="mt-4 font-bold">
              Registered At:
            </p>

            <p>{resultTimestamp}</p>
          </div>
        )}

        <p className="mt-4 text-center text-red-500 break-all">
          {status}
        </p>
      </div>
    </div>
  );
}