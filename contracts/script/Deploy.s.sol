// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";

/// @dev Deploys all Backstage contracts to Aeneid.
///      Run: forge script script/Deploy.s.sol --rpc-url aeneid --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("WALLET_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // Deployed in Step 4 — contracts are written in Step 2.
        // This script will import and deploy:
        //   TieredLicenseReadCondition
        //   TimeWindowedReadCondition
        //   BackstageRegistry
        //   SubscriptionNFT (implementation only; creators deploy proxies)

        vm.stopBroadcast();
    }
}
