import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Contract ABI for WaterResourceManager
const contractABI = [
  "function authority() view returns (address)",
  "function currentAllocationPeriod() view returns (uint32)",
  "function totalRegions() view returns (uint32)",
  "function nextRegionId() view returns (uint32)",
  "function registerRegion(string calldata name, uint32 _priorityLevel, address _manager) external returns (uint32)",
  "function startAllocationPeriod(uint32 _totalAvailableWater, uint256 _durationHours) external",
  "function submitWaterRequest(uint32 _requestedAmount, uint32 _justificationScore) external",
  "function processAllocation() external",
  "function emergencyWaterAllocation(uint32 regionId, uint32 emergencyAmount) external",
  "function deactivateRegion(uint32 regionId) external",
  "function updateRegionManager(uint32 regionId, address newManager) external",
  "function getRegionInfo(uint32 regionId) view returns (string memory name, bool isActive, uint256 lastUpdateTime, address manager)",
  "function getCurrentPeriodInfo() view returns (uint32 periodId, uint256 startTime, uint256 endTime, bool distributionCompleted, uint32 participatingRegions, bool isActive)",
  "function getRegionRequestStatus(uint32 regionId) view returns (bool hasSubmittedRequest, bool isProcessed, uint256 timestamp)",
  "function isAllocationPeriodActive() view returns (bool)",
  "event RegionRegistered(uint32 indexed regionId, string name, address manager)",
  "event AllocationPeriodStarted(uint32 indexed periodId, uint256 startTime)",
  "event WaterRequested(uint32 indexed regionId, uint32 indexed periodId, address requester)",
  "event WaterAllocated(uint32 indexed regionId, uint32 indexed periodId, uint32 amount)",
  "event AllocationCompleted(uint32 indexed periodId, uint32 totalRegions)",
  "event EmergencyAllocation(uint32 indexed regionId, uint32 amount)"
];

interface LogEntry {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: string;
}

interface PeriodInfo {
  periodId: ethers.BigNumber;
  startTime: ethers.BigNumber;
  endTime: ethers.BigNumber;
  distributionCompleted: boolean;
  participatingRegions: ethers.BigNumber;
  isActive: boolean;
}

export default function Home() {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.providers.JsonRpcSigner | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isRegionManager, setIsRegionManager] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [networkName, setNetworkName] = useState<string>('Not Connected');
  const [chainId, setChainId] = useState<string>('-');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string>('Please connect your wallet first');

  // Form states
  const [regionName, setRegionName] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('');
  const [managerAddress, setManagerAddress] = useState('');
  const [totalWaterAmount, setTotalWaterAmount] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [justificationScore, setJustificationScore] = useState('');
  const [emergencyRegionId, setEmergencyRegionId] = useState('');
  const [emergencyAmount, setEmergencyAmount] = useState('');
  const [deactivateRegionId, setDeactivateRegionId] = useState('');
  const [viewRegionId, setViewRegionId] = useState('');
  const [statusRegionId, setStatusRegionId] = useState('');
  const [regionInfo, setRegionInfo] = useState<string>('');
  const [requestStatus, setRequestStatus] = useState<string>('');
  const [contractAddressInput, setContractAddressInput] = useState('');

  // Initialize contract address on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('contractAddress');
    const defaultAddress = '0x4E2c3faE5165E4d5f9E2dEcFEA50e84399157b76';
    const address = savedAddress || defaultAddress;
    setContractAddressInput(address);
    setContractAddress(address);
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{ message, type, timestamp }, ...prev.slice(0, 9)]);
  }, []);

  const updateWorkflowStatus = useCallback(async () => {
    if (!contract) {
      setWorkflowStatus('Contract not connected. Please set contract address.');
      return;
    }

    try {
      const isActive = await contract.isAllocationPeriodActive();
      const currentPeriod = await contract.currentAllocationPeriod();

      if (isAdmin && currentPeriod.eq(0)) {
        setWorkflowStatus('Admin Action Required: Register regions and start first allocation period');
      } else if (isAdmin && !isActive) {
        setWorkflowStatus('Admin Action Required: Start new allocation period');
      } else if (isActive) {
        setWorkflowStatus('Active Allocation Period: Region managers can submit water requests');
      } else {
        setWorkflowStatus('Waiting: No active allocation period');
      }
    } catch (error) {
      setWorkflowStatus('Error: Unable to check contract status');
    }
  }, [contract, isAdmin]);

  const loadPeriodInfo = useCallback(async () => {
    if (!contract) {
      setPeriodInfo(null);
      return;
    }

    try {
      const info = await contract.getCurrentPeriodInfo();
      setPeriodInfo(info);
      updateWorkflowStatus();
    } catch (error) {
      console.error('Failed to load period info:', error);
      setPeriodInfo(null);
    }
  }, [contract, updateWorkflowStatus]);

  const checkUserRole = useCallback(async () => {
    if (!contract || !userAddress) return;

    try {
      const authority = await contract.authority();
      setIsAdmin(authority.toLowerCase() === userAddress.toLowerCase());
      setIsRegionManager(true); // Allow all users to act as region managers for testing
      updateWorkflowStatus();
    } catch (error) {
      console.error('Failed to check user role:', error);
      addLog('Failed to check user role: ' + (error as Error).message, 'warning');
    }
  }, [contract, userAddress, addLog, updateWorkflowStatus]);

  const handleSetContractAddress = () => {
    const inputAddress = contractAddressInput.trim();

    if (!inputAddress) {
      addLog('Please enter a contract address', 'warning');
      return;
    }

    if (!ethers.utils.isAddress(inputAddress)) {
      addLog('Invalid contract address format', 'error');
      return;
    }

    setContractAddress(inputAddress);
    localStorage.setItem('contractAddress', inputAddress);

    // Re-initialize contract if wallet is connected
    if (signer) {
      const newContract = new ethers.Contract(inputAddress, contractABI, signer);
      setContract(newContract);
    }

    addLog('Contract address set successfully', 'success');
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Please install MetaMask wallet');
      }

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setUserAddress(address);

      // Get network info
      const network = await web3Provider.getNetwork();
      setNetworkName(network.name || 'Unknown');
      setChainId(network.chainId.toString());

      // Initialize contract if address is set
      if (contractAddress) {
        const newContract = new ethers.Contract(contractAddress, contractABI, web3Signer);
        setContract(newContract);
      }

      setIsConnected(true);
      addLog('Wallet connected successfully', 'success');

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          window.location.reload();
        } else {
          window.location.reload();
        }
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      addLog('Failed to connect wallet: ' + (error as Error).message, 'error');
    }
  };

  // Load user role and period info when contract is ready
  useEffect(() => {
    if (contract && userAddress) {
      checkUserRole();
      loadPeriodInfo();
    }
  }, [contract, userAddress, checkUserRole, loadPeriodInfo]);

  const registerRegion = async () => {
    if (!contract) {
      addLog('Please connect wallet and set contract address first', 'error');
      return;
    }

    try {
      if (!regionName || !priorityLevel || !managerAddress) {
        throw new Error('Please fill all fields');
      }

      if (!ethers.utils.isAddress(managerAddress)) {
        throw new Error('Invalid manager address');
      }

      addLog('Registering region...', 'info');
      const tx = await contract.registerRegion(regionName, parseInt(priorityLevel), managerAddress);

      addLog('Transaction sent, waiting for confirmation...', 'info');
      const receipt = await tx.wait();

      addLog(`Region "${regionName}" registered successfully`, 'success');
      addLog(`Transaction hash: ${receipt.transactionHash}`, 'info');

      setRegionName('');
      setPriorityLevel('');
      setManagerAddress('');
    } catch (error) {
      console.error('Failed to register region:', error);
      addLog('Failed to register region: ' + (error as Error).message, 'error');
    }
  };

  const startAllocationPeriod = async () => {
    if (!contract) {
      addLog('Please connect wallet and set contract address first', 'error');
      return;
    }

    try {
      if (!totalWaterAmount || !durationHours) {
        throw new Error('Please fill all fields');
      }

      addLog('Starting allocation period...', 'info');
      const tx = await contract.startAllocationPeriod(parseInt(totalWaterAmount), parseInt(durationHours));

      addLog('Transaction sent, waiting for confirmation...', 'info');
      const receipt = await tx.wait();

      addLog('Allocation period started successfully', 'success');
      addLog(`Transaction hash: ${receipt.transactionHash}`, 'info');

      setTotalWaterAmount('');
      setDurationHours('');
      await loadPeriodInfo();
    } catch (error) {
      console.error('Failed to start allocation period:', error);
      addLog('Failed to start allocation period: ' + (error as Error).message, 'error');
    }
  };

  const submitWaterRequest = async () => {
    if (!contract) {
      addLog('Please connect wallet and set contract address first', 'error');
      return;
    }

    try {
      const isActive = await contract.isAllocationPeriodActive();
      if (!isActive) {
        addLog('Cannot submit request: No active allocation period. Please wait for admin to start an allocation period.', 'error');
        updateWorkflowStatus();
        return;
      }

      if (!requestAmount || !justificationScore) {
        throw new Error('Please fill all fields');
      }

      const score = parseInt(justificationScore);
      if (score < 1 || score > 100) {
        throw new Error('Urgency score must be between 1 and 100');
      }

      addLog('Submitting water request...', 'info');
      const tx = await contract.submitWaterRequest(parseInt(requestAmount), score);

      addLog('Transaction sent, waiting for confirmation...', 'info');
      const receipt = await tx.wait();

      addLog('Water request submitted successfully', 'success');
      addLog(`Transaction hash: ${receipt.transactionHash}`, 'info');

      setRequestAmount('');
      setJustificationScore('');
      updateWorkflowStatus();
    } catch (error) {
      console.error('Failed to submit water request:', error);
      let errorMessage = (error as Error).message;

      if (errorMessage.includes('Not during allocation period')) {
        errorMessage = 'Cannot submit request: No active allocation period. Admin must start allocation period first.';
      } else if (errorMessage.includes('Not a registered region manager')) {
        errorMessage = 'You are not registered as a region manager. Please contact the admin.';
      } else if (errorMessage.includes('Region already submitted request')) {
        errorMessage = 'Your region has already submitted a request for this allocation period.';
      }

      addLog('Failed to submit water request: ' + errorMessage, 'error');
      updateWorkflowStatus();
    }
  };

  const processAllocation = async () => {
    if (!contract) {
      addLog('Please connect wallet and set contract address first', 'error');
      return;
    }

    try {
      addLog('Processing water allocation...', 'info');
      const tx = await contract.processAllocation();

      addLog('Transaction sent, waiting for confirmation...', 'info');
      const receipt = await tx.wait();

      addLog('Water allocation processed successfully', 'success');
      addLog(`Transaction hash: ${receipt.transactionHash}`, 'info');

      await loadPeriodInfo();
    } catch (error) {
      console.error('Failed to process allocation:', error);
      addLog('Failed to process allocation: ' + (error as Error).message, 'error');
    }
  };

  const emergencyAllocation = async () => {
    if (!contract) {
      addLog('Please connect wallet and set contract address first', 'error');
      return;
    }

    try {
      if (!emergencyRegionId || !emergencyAmount) {
        throw new Error('Please fill all fields');
      }

      addLog('Processing emergency allocation...', 'info');
      const tx = await contract.emergencyWaterAllocation(parseInt(emergencyRegionId), parseInt(emergencyAmount));

      addLog('Transaction sent, waiting for confirmation...', 'info');
      const receipt = await tx.wait();

      addLog(`Emergency allocation for region ${emergencyRegionId} completed`, 'success');
      addLog(`Transaction hash: ${receipt.transactionHash}`, 'info');

      setEmergencyRegionId('');
      setEmergencyAmount('');
    } catch (error) {
      console.error('Failed to process emergency allocation:', error);
      addLog('Failed to process emergency allocation: ' + (error as Error).message, 'error');
    }
  };

  const deactivateRegion = async () => {
    if (!contract) {
      addLog('Please connect wallet and set contract address first', 'error');
      return;
    }

    try {
      if (!deactivateRegionId) {
        throw new Error('Please enter region ID');
      }

      addLog('Deactivating region...', 'info');
      const tx = await contract.deactivateRegion(parseInt(deactivateRegionId));

      addLog('Transaction sent, waiting for confirmation...', 'info');
      const receipt = await tx.wait();

      addLog(`Region ${deactivateRegionId} deactivated successfully`, 'success');
      addLog(`Transaction hash: ${receipt.transactionHash}`, 'info');

      setDeactivateRegionId('');
    } catch (error) {
      console.error('Failed to deactivate region:', error);
      addLog('Failed to deactivate region: ' + (error as Error).message, 'error');
    }
  };

  const viewRegionInfo = async () => {
    if (!contract) {
      addLog('Please connect wallet and set contract address first', 'error');
      return;
    }

    try {
      if (!viewRegionId) {
        throw new Error('Please enter region ID');
      }

      const info = await contract.getRegionInfo(parseInt(viewRegionId));

      const html = `
        <div class="alert alert-info">
          <strong>Region Name:</strong> ${info.name}<br>
          <strong>Active:</strong> ${info.isActive ? 'Yes' : 'No'}<br>
          <strong>Manager:</strong> ${info.manager}<br>
          <strong>Last Update:</strong> ${new Date(info.lastUpdateTime.toNumber() * 1000).toLocaleString()}
        </div>
      `;

      setRegionInfo(html);
    } catch (error) {
      console.error('Failed to get region info:', error);
      setRegionInfo(`<div class="alert alert-danger">Failed to load region info: ${(error as Error).message}</div>`);
    }
  };

  const viewRequestStatus = async () => {
    if (!contract) {
      addLog('Please connect wallet and set contract address first', 'error');
      return;
    }

    try {
      if (!statusRegionId) {
        throw new Error('Please enter region ID');
      }

      const status = await contract.getRegionRequestStatus(parseInt(statusRegionId));

      const html = `
        <div class="alert alert-info">
          <strong>Has Submitted Request:</strong> ${status.hasSubmittedRequest ? 'Yes' : 'No'}<br>
          <strong>Is Processed:</strong> ${status.isProcessed ? 'Yes' : 'No'}<br>
          <strong>Timestamp:</strong> ${status.timestamp.gt(0) ? new Date(status.timestamp.toNumber() * 1000).toLocaleString() : 'Not available'}
        </div>
      `;

      setRequestStatus(html);
    } catch (error) {
      console.error('Failed to get request status:', error);
      setRequestStatus(`<div class="alert alert-danger">Failed to load request status: ${(error as Error).message}</div>`);
    }
  };

  return (
    <div className="container">
      <div className="text-center mb-5">
        <div className="water-icon">💧</div>
        <h1 className="display-4">Water Resource Management System</h1>
        <p className="lead">FHE-based Privacy-Preserving Water Resource Allocation Platform</p>
      </div>

      {/* Workflow Guide */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <h5 className="card-title">System Workflow Guide</h5>
            <div className="row">
              <div className="col-md-3">
                <div className="text-center">
                  <div style={{ fontSize: '2em', color: '#00d4ff' }}>1</div>
                  <h6>Connect Wallet</h6>
                  <p className="small">Connect your MetaMask wallet to interact with the system</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-center">
                  <div style={{ fontSize: '2em', color: '#00ff88' }}>2</div>
                  <h6>Admin: Register Regions</h6>
                  <p className="small">Authority registers regions and their managers</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-center">
                  <div style={{ fontSize: '2em', color: '#ff6b6b' }}>3</div>
                  <h6>Admin: Start Period</h6>
                  <p className="small">Authority starts allocation period with total water amount</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-center">
                  <div style={{ fontSize: '2em', color: '#7c4dff' }}>4</div>
                  <h6>Managers: Submit Requests</h6>
                  <p className="small">Region managers submit water requests during active period</p>
                </div>
              </div>
            </div>
            <div className="alert alert-info mt-3">
              <strong>Current Status:</strong> {workflowStatus}
            </div>
          </div>
        </div>
      </div>

      {/* Network & Contract Info */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <h5 className="card-title">Network & Contract Information</h5>
            <div className="row">
              <div className="col-md-6">
                <p><strong>Network:</strong> {networkName}</p>
                <p><strong>Chain ID:</strong> {chainId}</p>
              </div>
              <div className="col-md-6">
                <p><strong>Contract Address:</strong></p>
                <p className="contract-address">{contractAddress || 'Not Set'}</p>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Enter contract address"
                  value={contractAddressInput}
                  onChange={(e) => setContractAddressInput(e.target.value)}
                />
                <button className="btn btn-sm btn-outline-primary mt-2" onClick={handleSetContractAddress}>
                  Set Contract
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="text-center">
              <h5 className="card-title">Connection Status</h5>
              <p className="mb-3">
                {isConnected ? (
                  <span className="badge-success status-badge">Connected: {userAddress.slice(0, 10)}...</span>
                ) : (
                  <span className="badge-warning status-badge">Not Connected</span>
                )}
              </p>
              <button className="btn btn-primary" onClick={connectWallet} disabled={isConnected}>
                {isConnected ? 'Connected' : 'Connect Wallet'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Functions */}
      {isAdmin && (
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card">
              <h5 className="card-title">Register New Region</h5>
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Region Name"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Priority Level (1-10)"
                  min="1"
                  max="10"
                  value={priorityLevel}
                  onChange={(e) => setPriorityLevel(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Manager Address"
                  value={managerAddress}
                  onChange={(e) => setManagerAddress(e.target.value)}
                />
              </div>
              <button className="btn btn-success" onClick={registerRegion}>
                Register Region
              </button>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <h5 className="card-title">Start Allocation Period</h5>
              <div className="mb-3">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Total Water Amount"
                  value={totalWaterAmount}
                  onChange={(e) => setTotalWaterAmount(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Duration (Hours)"
                  min="1"
                  max="168"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={startAllocationPeriod}>
                Start Allocation
              </button>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <h5 className="card-title">Emergency Allocation</h5>
              <div className="mb-3">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Region ID"
                  value={emergencyRegionId}
                  onChange={(e) => setEmergencyRegionId(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Emergency Amount"
                  value={emergencyAmount}
                  onChange={(e) => setEmergencyAmount(e.target.value)}
                />
              </div>
              <button className="btn btn-warning" onClick={emergencyAllocation}>
                Emergency Allocation
              </button>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <h5 className="card-title">Region Management</h5>
              <div className="mb-3">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Region ID to Deactivate"
                  value={deactivateRegionId}
                  onChange={(e) => setDeactivateRegionId(e.target.value)}
                />
              </div>
              <button className="btn btn-danger" onClick={deactivateRegion}>
                Deactivate Region
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Region Manager Functions */}
      {isRegionManager && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <h5 className="card-title">Submit Water Request</h5>
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Requested Amount"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Urgency Score (1-100)"
                      min="1"
                      max="100"
                      value={justificationScore}
                      onChange={(e) => setJustificationScore(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <button className="btn btn-success" onClick={submitWaterRequest}>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Functions */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <h5 className="card-title">Region Information</h5>
            <div className="mb-3">
              <input
                type="number"
                className="form-control"
                placeholder="Region ID"
                value={viewRegionId}
                onChange={(e) => setViewRegionId(e.target.value)}
              />
            </div>
            <button className="btn btn-info" onClick={viewRegionInfo}>
              View Region
            </button>
            {regionInfo && <div className="mt-3" dangerouslySetInnerHTML={{ __html: regionInfo }} />}
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <h5 className="card-title">Request Status</h5>
            <div className="mb-3">
              <input
                type="number"
                className="form-control"
                placeholder="Region ID"
                value={statusRegionId}
                onChange={(e) => setStatusRegionId(e.target.value)}
              />
            </div>
            <button className="btn btn-info" onClick={viewRequestStatus}>
              View Status
            </button>
            {requestStatus && <div className="mt-3" dangerouslySetInnerHTML={{ __html: requestStatus }} />}
          </div>
        </div>
      </div>

      {/* Current Allocation Period Info */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <h5 className="card-title">Current Allocation Period Status</h5>
            {periodInfo ? (
              <div>
                <div className="row">
                  <div className="col-md-3">
                    <strong>Period ID:</strong> {periodInfo.periodId.toString()}
                  </div>
                  <div className="col-md-3">
                    <strong>Status:</strong>{' '}
                    <span className={`status-badge ${periodInfo.isActive ? 'badge-success' : 'badge-secondary'}`}>
                      {periodInfo.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="col-md-3">
                    <strong>Participating Regions:</strong> {periodInfo.participatingRegions.toString()}
                  </div>
                  <div className="col-md-3">
                    <strong>Distribution Completed:</strong>{' '}
                    <span className={`status-badge ${periodInfo.distributionCompleted ? 'badge-success' : 'badge-warning'}`}>
                      {periodInfo.distributionCompleted ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                {periodInfo.periodId.gt(0) && (
                  <div className="row mt-3">
                    <div className="col-md-6">
                      <strong>Start Time:</strong> {new Date(periodInfo.startTime.toNumber() * 1000).toLocaleString()}
                    </div>
                    <div className="col-md-6">
                      <strong>End Time:</strong> {new Date(periodInfo.endTime.toNumber() * 1000).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted">Please connect wallet and set contract address first</p>
            )}
            <button className="btn btn-warning mt-3" onClick={loadPeriodInfo}>
              Refresh Status
            </button>
            {periodInfo && periodInfo.isActive && !periodInfo.distributionCompleted && isAdmin && (
              <button className="btn btn-primary mt-3" style={{ marginLeft: '10px' }} onClick={processAllocation}>
                Process Allocation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Operation History */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <h5 className="card-title">Operation History</h5>
            {logs.length === 0 ? (
              <p className="text-muted">No operations recorded</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`alert alert-${log.type}`}>
                  <strong>[{log.timestamp}]</strong> {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
