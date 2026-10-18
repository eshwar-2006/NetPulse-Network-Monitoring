import platform
import subprocess
import re
import time
import requests
import psutil
from typing import Dict, Any, Optional, Tuple

class MonitoringService:
    @staticmethod
    def ping_host(host: str, count: int = 3, timeout_sec: int = 3) -> Dict[str, Any]:
        """
        Executes a safe system ping subprocess on Windows or Linux.
        Returns round-trip latency, packet loss percentage, reachability, and raw output.
        """
        is_windows = platform.system().lower() == 'windows'
        
        # Build command based on OS
        if is_windows:
            cmd = ['ping', '-n', str(count), '-w', str(timeout_sec * 1000), host]
        else:
            cmd = ['ping', '-c', str(count), '-W', str(timeout_sec), host]
            
        start_time = time.time()
        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout_sec * count + 2
            )
            output = result.stdout
            
            # Parse packet loss
            loss_match = re.search(r'(\d+)% packet loss', output) or re.search(r'Loss = \d+ \((\d+)% loss\)', output)
            packet_loss = float(loss_match.group(1)) if loss_match else (0.0 if result.returncode == 0 else 100.0)
            
            # Parse round-trip average latency
            latency_ms = None
            if not is_windows:
                # Linux: rtt min/avg/max/mdev = 12.345/14.567/16.789/1.234 ms
                rtt_match = re.search(r'rtt min/avg/max/mdev = [\d\.]+/([\d\.]+)/', output)
                if rtt_match:
                    latency_ms = round(float(rtt_match.group(1)), 2)
            else:
                # Windows: Average = 14ms or Minimum = 12ms, Maximum = 16ms, Average = 14ms
                avg_match = re.search(r'Average = (\d+)ms', output)
                if avg_match:
                    latency_ms = round(float(avg_match.group(1)), 2)
            
            if latency_ms is None and packet_loss < 100.0:
                # Fallback to elapsed probe time divided by count
                latency_ms = round(((time.time() - start_time) / count) * 1000, 2)
                
            is_reachable = packet_loss < 100.0 and latency_ms is not None
            
            return {
                'reachable': is_reachable,
                'latency_ms': latency_ms,
                'packet_loss_pct': packet_loss,
                'error': None if is_reachable else (result.stderr.strip() or 'Host unreachable or ICMP blocked'),
                'raw_output': output
            }
        except subprocess.TimeoutExpired:
            return {
                'reachable': False,
                'latency_ms': None,
                'packet_loss_pct': 100.0,
                'error': f'Ping timed out after {timeout_sec}s',
                'raw_output': ''
            }
        except Exception as e:
            return {
                'reachable': False,
                'latency_ms': None,
                'packet_loss_pct': 100.0,
                'error': str(e),
                'raw_output': ''
            }

    @staticmethod
    def check_http(url: str, timeout_sec: int = 5) -> Dict[str, Any]:
        """
        Performs genuine HTTP/HTTPS GET probe.
        Measures response time in ms, captures HTTP status code.
        """
        if not url:
            return {'reachable': False, 'response_time_ms': None, 'status_code': None, 'error': 'No URL provided'}
            
        # Ensure scheme
        if not url.startswith('http://') and not url.startswith('https://'):
            url = f"https://{url}"

        try:
            start = time.perf_counter()
            response = requests.get(
                url,
                timeout=timeout_sec,
                headers={'User-Agent': 'NetPulse-Network-Monitor/1.0'},
                allow_redirects=True
            )
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            status_code = response.status_code
            is_reachable = (200 <= status_code < 400) or status_code in (401, 403)
            
            return {
                'reachable': is_reachable,
                'response_time_ms': elapsed_ms,
                'status_code': status_code,
                'error': None if is_reachable else f"HTTP Status {status_code}"
            }
        except requests.exceptions.Timeout:
            return {
                'reachable': False,
                'response_time_ms': None,
                'status_code': None,
                'error': f"Connection timed out after {timeout_sec}s"
            }
        except requests.exceptions.SSLError as e:
            return {
                'reachable': False,
                'response_time_ms': None,
                'status_code': None,
                'error': f"SSL Certificate Error: {str(e)}"
            }
        except requests.exceptions.ConnectionError as e:
            return {
                'reachable': False,
                'response_time_ms': None,
                'status_code': None,
                'error': f"Connection refused or DNS failure"
            }
        except Exception as e:
            return {
                'reachable': False,
                'response_time_ms': None,
                'status_code': None,
                'error': str(e)
            }

    @staticmethod
    def get_interface_stats(interface_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Collects network interface byte and packet counters using psutil.net_io_counters.
        """
        try:
            per_nic = psutil.net_io_counters(pernic=True)
            interfaces = list(per_nic.keys())
            
            selected_nic = interface_name if (interface_name and interface_name in per_nic) else (interfaces[0] if interfaces else None)
            
            if not selected_nic or selected_nic not in per_nic:
                total_counters = psutil.net_io_counters()
                return {
                    'interface': 'total',
                    'available_interfaces': interfaces,
                    'bytes_sent': total_counters.bytes_sent,
                    'bytes_recv': total_counters.bytes_recv,
                    'packets_sent': total_counters.packets_sent,
                    'packets_recv': total_counters.packets_recv,
                    'errin': total_counters.errin,
                    'errout': total_counters.errout,
                    'dropin': total_counters.dropin,
                    'dropout': total_counters.dropout
                }
                
            nic_data = per_nic[selected_nic]
            return {
                'interface': selected_nic,
                'available_interfaces': interfaces,
                'bytes_sent': nic_data.bytes_sent,
                'bytes_recv': nic_data.bytes_recv,
                'packets_sent': nic_data.packets_sent,
                'packets_recv': nic_data.packets_recv,
                'errin': nic_data.errin,
                'errout': nic_data.errout,
                'dropin': nic_data.dropin,
                'dropout': nic_data.dropout
            }
        except Exception as e:
            return {
                'interface': 'unknown',
                'available_interfaces': [],
                'bytes_sent': 0,
                'bytes_recv': 0,
                'packets_sent': 0,
                'packets_recv': 0,
                'error': str(e)
            }
