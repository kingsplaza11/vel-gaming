import json
from django.core.management.base import BaseCommand
from django.db.models import Count, Q
from django.db import connection
from wallets.models import WalletTransaction  # Replace with your actual app
from django.core import serializers


class Command(BaseCommand):
    help = 'Inspect WalletTransaction meta field structure'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=20,
            help='Number of transactions to inspect (default: 20)'
        )
        parser.add_argument(
            '--tx-type',
            type=str,
            choices=['CREDIT', 'DEBIT', 'all'],
            default='all',
            help='Filter by transaction type'
        )
        parser.add_argument(
            '--first-deposit',
            action='store_true',
            help='Filter first deposits only'
        )
        parser.add_argument(
            '--group-by-meta',
            action='store_true',
            help='Group and count by meta keys'
        )
        parser.add_argument(
            '--show-all',
            action='store_true',
            help='Show all meta data without truncation'
        )

    def handle(self, *args, **options):
        limit = options['limit']
        tx_type = options['tx_type']
        first_deposit = options['first_deposit']
        group_by_meta = options['group_by_meta']
        show_all = options['show_all']
        
        # Build queryset
        qs = WalletTransaction.objects.all()
        
        if tx_type != 'all':
            qs = qs.filter(tx_type=tx_type)
        
        if first_deposit:
            qs = qs.filter(first_deposit=True)
        
        total_count = qs.count()
        
        self.stdout.write(self.style.SUCCESS(f'Total transactions: {total_count}'))
        self.stdout.write(f'Transaction type filter: {tx_type}')
        self.stdout.write(f'First deposit only: {first_deposit}')
        self.stdout.write('=' * 80)
        
        if group_by_meta:
            self.analyze_meta_structure(qs)
        else:
            self.display_meta_samples(qs, limit, show_all)
        
        # Show some statistics
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS('Transaction Statistics:'))
        
        stats = WalletTransaction.objects.aggregate(
            total_credits=Count('id', filter=Q(tx_type='CREDIT')),
            total_debits=Count('id', filter=Q(tx_type='DEBIT')),
            first_deposits=Count('id', filter=Q(first_deposit=True)),
            with_meta=Count('id', filter=Q(meta__isnull=False) & ~Q(meta={})),
        )
        
        self.stdout.write(f"Total CREDIT transactions: {stats['total_credits']}")
        self.stdout.write(f"Total DEBIT transactions: {stats['total_debits']}")
        self.stdout.write(f"First deposits: {stats['first_deposits']}")
        self.stdout.write(f"Transactions with meta data: {stats['with_meta']}")
        
        # Show common meta keys if any
        if stats['with_meta'] > 0:
            self.stdout.write('\nChecking for common meta patterns...')
            self.find_common_meta_patterns()

    def analyze_meta_structure(self, qs):
        """Analyze and group by meta field keys"""
        self.stdout.write(self.style.SUCCESS('Analyzing meta field structure...'))
        
        # Get all unique meta structures
        transactions = qs.exclude(meta__isnull=True).exclude(meta={})[:1000]
        
        meta_keys_counter = {}
        meta_values_samples = {}
        
        for tx in transactions:
            if isinstance(tx.meta, dict):
                for key in tx.meta.keys():
                    meta_keys_counter[key] = meta_keys_counter.get(key, 0) + 1
                    # Store a sample value for this key
                    if key not in meta_values_samples:
                        meta_values_samples[key] = tx.meta[key]
        
        if not meta_keys_counter:
            self.stdout.write(self.style.WARNING('No meta data found in transactions'))
            return
        
        self.stdout.write('\nMeta keys found (with count):')
        for key, count in sorted(meta_keys_counter.items(), key=lambda x: x[1], reverse=True):
            self.stdout.write(f"  {key}: {count} occurrences")
        
        self.stdout.write('\nSample values for each key:')
        for key, sample in meta_values_samples.items():
            self.stdout.write(f"\n  {key}:")
            if isinstance(sample, (dict, list)):
                self.stdout.write(f"    {json.dumps(sample, indent=4, default=str)}")
            else:
                self.stdout.write(f"    {sample}")

    def display_meta_samples(self, qs, limit, show_all):
        """Display sample transactions with their meta data"""
        self.stdout.write(self.style.SUCCESS(f'Showing {min(limit, qs.count())} sample transactions:'))
        
        for i, tx in enumerate(qs[:limit], 1):
            self.stdout.write(f'\n{"="*60}')
            self.stdout.write(f'Transaction #{i}:')
            self.stdout.write(f'  ID: {tx.id}')
            self.stdout.write(f'  User: {tx.user_id} ({tx.user.email if hasattr(tx.user, "email") else "N/A"})')
            self.stdout.write(f'  Amount: {tx.amount}')
            self.stdout.write(f'  Type: {tx.tx_type}')
            self.stdout.write(f'  First Deposit: {tx.first_deposit}')
            self.stdout.write(f'  Reference: {tx.reference}')
            self.stdout.write(f'  Created: {tx.created_at}')
            
            if tx.meta:
                self.stdout.write('  Meta Data:')
                if isinstance(tx.meta, dict):
                    for key, value in tx.meta.items():
                        if show_all or (isinstance(value, (str, int, float, bool))):
                            self.stdout.write(f'    {key}: {value}')
                        elif isinstance(value, (dict, list)):
                            self.stdout.write(f'    {key}: {json.dumps(value, default=str)[:100]}...')
                        else:
                            self.stdout.write(f'    {key}: {type(value).__name__}')
                else:
                    self.stdout.write(f'    {tx.meta}')
            else:
                self.stdout.write('  Meta Data: (empty)')

    def find_common_meta_patterns(self):
        """Try to identify common patterns in meta data"""
        # Check for common payment provider keys
        common_keys_to_check = [
            'status', 'payment_status', 'transaction_status',
            'payment_method', 'provider', 'gateway',
            'payment_id', 'transaction_id', 'order_id',
            'narration', 'description', 'remark',
            'channel', 'source', 'method'
        ]
        
        self.stdout.write('\nChecking for common payment-related keys:')
        
        for key in common_keys_to_check:
            # Use a raw query to check if key exists in JSON
            with connection.cursor() as cursor:
                cursor.execute(f"""
                    SELECT COUNT(*) 
                    FROM {WalletTransaction._meta.db_table}
                    WHERE meta->>'{key}' IS NOT NULL
                    LIMIT 1
                """)
                count = cursor.fetchone()[0]
                if count > 0:
                    self.stdout.write(f"  ✓ '{key}' found in {count} transactions")