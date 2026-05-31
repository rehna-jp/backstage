// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {TieredLicenseReadCondition} from "../src/TieredLicenseReadCondition.sol";
import {TimeWindowedReadCondition} from "../src/TimeWindowedReadCondition.sol";
import {BackstageRegistry} from "../src/BackstageRegistry.sol";
import {SubscriptionNFT} from "../src/SubscriptionNFT.sol";

/// @dev Deploys all Backstage contracts to Aeneid.
///      Run: forge script script/Deploy.s.sol --rpc-url aeneid --broadcast
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);

        TieredLicenseReadCondition tiered = new TieredLicenseReadCondition();
        console.log("TieredLicenseReadCondition:", address(tiered));

        TimeWindowedReadCondition windowed = new TimeWindowedReadCondition();
        console.log("TimeWindowedReadCondition:", address(windowed));

        BackstageRegistry registry = new BackstageRegistry();
        console.log("BackstageRegistry:", address(registry));

        // SubscriptionNFT is deployed per creator — deploy a sample one for the demo
        SubscriptionNFT subNft = new SubscriptionNFT(
            "Backstage Subscriber Pass",
            "BACK-SUB",
            0.001 ether,   // 0.001 IP per subscription
            deployer
        );
        console.log("SubscriptionNFT (demo):", address(subNft));

        vm.stopBroadcast();

        console.log("\n--- Add these to your .env ---");
        console.log("TIERED_LICENSE_READ_CONDITION=%s", address(tiered));
        console.log("TIME_WINDOWED_READ_CONDITION=%s", address(windowed));
        console.log("BACKSTAGE_REGISTRY=%s", address(registry));
        console.log("SUBSCRIPTION_NFT_DEMO=%s", address(subNft));
    }
}
