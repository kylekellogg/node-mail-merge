Build a Template System

In this test, you will build a template system that will be used to do
an old school "mail merge". The process is simple: using the provided
template and the data files in the input directory, output custom
documents in the output directory.


The data files are in the format:

key = value

Each key corresponds to a variable in the template. The output will be
the text in the template with the variables replaced with the data in
each file. For each data file there should be one output file. Some of
the data files contain missing or invalid information. How that data
is handled it up to you. You are writing a UNIX utility so you should
follow UNIX-y conventions such as outputting errors to stderr and "no
news is good news". If all goes well your program shouldn't print
anything.


There are some tricky parts to the test:

- You must read in the template and process it in a way which will
  allow the program reuse it to output thousands, perhaps millions of
  documents efficiently. Do not process the template for each data
  file.

- The template contains simple variables, but also a conditional block
  (if/else).

- There are variables with special formatting requirements

- You should handle whitespace appropriately.


The shell script which comprises the test harness: 

- A script called run which you must modify to run the program you
  will write.


Some of the test is intentionally open ended. We want to see how you
handle the implementation and deal with things which are not specified
but should be obvious to a skilled developer.


You can use any language and any IDE or editor you want. However we do
ask that you DO NOT use a ready-made template system. The problem is
to build your own from scratch. You can, however, use parser libraries
or other such facilities to help.
 

If you do not finish in time, do not worry. We will simply ask you to
explain your design and how you would proceed to finish the problem.

GOOD LUCK!



