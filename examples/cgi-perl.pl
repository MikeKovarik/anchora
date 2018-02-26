#!/usr/bin/perl

=head1 DESCRIPTION

printenv — a CGI program that just prints its environment

=cut
print "Content-type: text/plain\n\n";

for my $var ( sort keys %ENV ) {
 printf "%s = \"%s\"\n", $var, $ENV{$var};
}