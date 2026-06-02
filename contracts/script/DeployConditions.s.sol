// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {TieredLicenseReadCondition} from "../src/TieredLicenseReadCondition.sol";
import {TimeWindowedReadCondition} from "../src/TimeWindowedReadCondition.sol";

/// @dev Redeploys only the condition contracts (4-param interface fix).
///      Registry and SubscriptionNFT are unchanged.
///      Run: forge script script/DeployConditions.s.sol --rpc-url aeneid --broadcast
contract DeployConditions is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);

        TieredLicenseReadCondition tiered = new TieredLicenseReadCondition();
        console.log("TieredLicenseReadCondition:", address(tiered));

        TimeWindowedReadCondition windowed = new TimeWindowedReadCondition();
        console.log("TimeWindowedReadCondition:", address(windowed));

        vm.stopBroadcast();

        console.log("\n--- Update in your .env ---");
        console.log("TIERED_LICENSE_READ_CONDITION=%s", address(tiered));
        console.log("TIME_WINDOWED_READ_CONDITION=%s", address(windowed));
    }
}
