#!/usr/bin/env python3
"""
Realistic Server Upload Simulation
Simulates uploading to srv1156126.hstgr.cloud as vel_gaming
"""

import sys
import time
import random
import math
from datetime import datetime, timedelta
import os

class UploadSimulator:
    def __init__(self):
        self.server = "srv1156126.hstgr.cloud"
        self.user = "vel_gaming"
        self.base_speed = 0.0084  # KB/s
        self.total_size_mb = 1247.32
        self.total_size_kb = self.total_size_mb * 1024
        self.estimated_time = timedelta(hours=4, minutes=30)
        self.start_time = None
        self.transferred_kb = 0
        self.file_index = 0
        
        # Realistic file list
        self.files = [
            "game_assets/textures/hd_textures_v1.7.3.tar.gz",
            "game_assets/models/character_models_v2.1.1.bin",
            "source_code/server_backend_v3.4.0.zip",
            "database/player_data_backup_2024.sql",
            "configs/server_config_v2.8.1.json",
            "logs/debug_logs_compressed.tar",
            "media/cutscenes_4k_encoded.mkv",
            "plugins/custom_plugins_bundle.pkg",
            "cache/asset_cache_v1.2.0.cache",
            "binaries/linux_server_x64_v4.2.0"
        ]
        
        # ANSI color codes
        self.COLORS = {
            'RED': '\033[91m',
            'GREEN': '\033[92m',
            'YELLOW': '\033[93m',
            'BLUE': '\033[94m',
            'MAGENTA': '\033[95m',
            'CYAN': '\033[96m',
            'WHITE': '\033[97m',
            'BOLD': '\033[1m',
            'UNDERLINE': '\033[4m',
            'END': '\033[0m',
            'GRAY': '\033[90m'
        }
    
    def color(self, text, color_code):
        """Colorize text with ANSI codes"""
        return f"{color_code}{text}{self.COLORS['END']}"
    
    def clear_screen(self):
        """Clear terminal screen"""
        os.system('cls' if os.name == 'nt' else 'clear')
    
    def format_size(self, size_kb):
        """Format size in KB to appropriate unit"""
        if size_kb >= 1024 * 1024:  # GB
            return f"{size_kb / (1024 * 1024):.2f} GB"
        elif size_kb >= 1024:  # MB
            return f"{size_kb / 1024:.2f} MB"
        else:  # KB
            return f"{size_kb:.2f} KB"
    
    def format_time(self, seconds):
        """Format seconds to HH:MM:SS"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    
    def progress_bar(self, current, total, width=40):
        """Create a progress bar"""
        percentage = (current / total) * 100
        filled = int(width * current / total)
        empty = width - filled
        
        bar = "█" * filled + "░" * empty
        return f"[{bar}] {percentage:6.2f}%"
    
    def get_current_speed(self):
        """Get current speed with realistic fluctuations"""
        # Add random fluctuations (±15%)
        fluctuation = random.uniform(0.85, 1.15)
        speed = self.base_speed * fluctuation
        
        # Occasionally add significant slowdowns
        if random.random() < 0.02:  # 2% chance
            speed *= random.uniform(0.1, 0.5)
        
        return speed
    
    def simulate_network_events(self, elapsed):
        """Simulate realistic network events"""
        events = []
        
        # Packet loss warning
        if elapsed % 47 == 0 and random.random() < 0.3:
            loss = random.uniform(0.1, 0.8)
            events.append(f"Packet loss detected ({loss:.1f}%). Retransmitting...")
        
        # Buffer clearing
        if elapsed % 61 == 0 and random.random() < 0.25:
            events.append("Network buffer cleared. Speed improved temporarily.")
        
        # Connection quality change
        if elapsed % 89 == 0 and random.random() < 0.2:
            quality = random.choice(["Good", "Fair", "Poor", "Excellent"])
            events.append(f"Connection quality: {quality}")
        
        return events
    
    def print_header(self):
        """Print the upload header"""
        print(self.color("╔══════════════════════════════════════════════════════════════╗", self.COLORS['CYAN']))
        print(self.color("║                 SECURE FILE TRANSFER PROTOCOL                ║", self.COLORS['CYAN']))
        print(self.color("╚══════════════════════════════════════════════════════════════╝", self.COLORS['CYAN']))
        print()
        
        print(self.color(f"Connecting to {self.server} as {self.user}...", self.COLORS['YELLOW']))
        time.sleep(1.2)
        print(self.color("✓ Connection established via SSH (RSA-4096)", self.COLORS['GREEN']))
        print(self.color("  Authentication: Public key accepted", self.COLORS['GRAY']))
        time.sleep(0.8)
        
        print()
        print(self.color("╔══════════════════════════════════════════════════════════════╗", self.COLORS['BLUE']))
        print(self.color("║                     UPLOAD INITIATION                        ║", self.COLORS['BLUE']))
        print(self.color("╚══════════════════════════════════════════════════════════════╝", self.COLORS['BLUE']))
        print()
        
        print(f"Remote Directory: {self.color(f'/home/{self.user}/deployment/', self.COLORS['WHITE'])}")
        print(f"Total Transfer Size: {self.color(self.format_size(self.total_size_kb), self.COLORS['WHITE'])}")
        print(f"Estimated Time: {self.color('04:30:00', self.COLORS['YELLOW'])}")
        print(f"Average Speed: {self.color(f'{self.base_speed:.4f} KB/s', self.COLORS['YELLOW'])}")
        print(f"Compression: {self.color('Enabled (DEFLATE)', self.COLORS['GRAY'])}")
        print(f"Encryption: {self.color('AES-256-GCM', self.COLORS['GRAY'])}")
        print()
        
        print(self.color("Starting upload process...", self.COLORS['YELLOW']))
        time.sleep(2)
    
    def run(self):
        """Run the upload simulation"""
        self.clear_screen()
        self.print_header()
        
        self.start_time = time.time()
        current_file = self.files[0]
        last_file_change = 0
        
        try:
            while self.transferred_kb < self.total_size_kb:
                elapsed = time.time() - self.start_time
                
                # Calculate current speed and progress
                current_speed = self.get_current_speed()
                transferred_this_cycle = current_speed * 0.5  # Update every 0.5s
                self.transferred_kb += transferred_this_cycle
                
                if self.transferred_kb > self.total_size_kb:
                    self.transferred_kb = self.total_size_kb
                
                # Calculate remaining time
                if current_speed > 0:
                    remaining_kb = self.total_size_kb - self.transferred_kb
                    remaining_seconds = remaining_kb / current_speed
                else:
                    remaining_seconds = self.estimated_time.total_seconds()
                
                # Change file every ~30 simulated seconds
                if int(elapsed) % 30 == 0 and int(elapsed) > last_file_change:
                    self.file_index = (self.file_index + 1) % len(self.files)
                    current_file = self.files[self.file_index]
                    last_file_change = int(elapsed)
                
                # Clear line and print progress
                line_length = 120
                print(" " * line_length, end="\r")
                
                timestamp = datetime.now().strftime("%H:%M:%S")
                progress = self.progress_bar(self.transferred_kb, self.total_size_kb)
                
                print(f"{self.color(timestamp, self.COLORS['CYAN'])} {progress} | "
                      f"Speed: {self.color(f'{current_speed:.4f} KB/s', self.COLORS['YELLOW'])} | "
                      f"ETA: {self.color(self.format_time(remaining_seconds), self.COLORS['RED'])} | "
                      f"File: {self.color(current_file, self.COLORS['GREEN'])}")
                
                # Print network events
                events = self.simulate_network_events(int(elapsed))
                for event in events:
                    if "Packet loss" in event:
                        print(f"  {self.color('[WARNING]', self.COLORS['RED'])} {event}")
                    elif "improved" in event:
                        print(f"  {self.color('[INFO]', self.COLORS['GREEN'])} {event}")
                    else:
                        print(f"  {self.color('[STATUS]', self.COLORS['BLUE'])} {event}")
                
                # Print transfer stats every 10 seconds
                if int(elapsed) % 10 == 0:
                    print(f"  {self.color('[STATS]', self.COLORS['MAGENTA'])} "
                          f"Transferred: {self.format_size(self.transferred_kb)} / "
                          f"{self.format_size(self.total_size_kb)} | "
                          f"Files: {self.file_index + 1}/{len(self.files)}")
                
                time.sleep(0.5)
        
        except KeyboardInterrupt:
            print(f"\n\n{self.color('[INTERRUPTED]', self.COLORS['YELLOW'])} Upload paused by user")
            return
        
        # Upload completed
        actual_elapsed = time.time() - self.start_time
        avg_speed = self.total_size_kb / actual_elapsed
        
        print("\n")
        print(self.color("╔══════════════════════════════════════════════════════════════╗", self.COLORS['GREEN']))
        print(self.color("║                    UPLOAD COMPLETED                          ║", self.COLORS['GREEN']))
        print(self.color("╚══════════════════════════════════════════════════════════════╝", self.COLORS['GREEN']))
        print()
        
        print(f"Total Time: {self.color(self.format_time(actual_elapsed), self.COLORS['WHITE'])}")
        print(f"Average Speed: {self.color(f'{avg_speed:.4f} KB/s', self.COLORS['WHITE'])}")
        print(f"Transferred: {self.color(self.format_size(self.total_size_kb), self.COLORS['WHITE'])}")
        print(f"Files: {self.color(f'{len(self.files)} files', self.COLORS['WHITE'])}")
        print(f"Integrity Check: {self.color('✓ PASSED (SHA-256 verified)', self.COLORS['GREEN'])}")
        print()
        
        print(self.color("Running post-upload procedures...", self.COLORS['YELLOW']))
        time.sleep(1)
        print(self.color("✓ File permissions updated", self.COLORS['GRAY']))
        time.sleep(0.5)
        print(self.color("✓ Ownership set to vel_gaming:www-data", self.COLORS['GRAY']))
        time.sleep(0.5)
        print(self.color("✓ Symlinks verified", self.COLORS['GRAY']))
        time.sleep(0.5)
        
        print()
        print(self.color(f"Disconnecting from {self.server}...", self.COLORS['YELLOW']))
        time.sleep(1)
        print(self.color("✓ Connection closed", self.COLORS['GREEN']))
        print()


if __name__ == "__main__":
    simulator = UploadSimulator()
    simulator.run()