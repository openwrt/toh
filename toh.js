function loadStyle(url) {
  return new Promise(function (acceptFn, rejectFn) {
    var link = document.createElement("link");
    link.onload = acceptFn;
    link.onerror = rejectFn;
    document.querySelector("head").appendChild(link);
    link.rel = "stylesheet";
    link.href = url;
  });
}
function loadScript(url) {
  return new Promise(function (acceptFn, rejectFn) {
    var script = document.createElement("script");
    script.onload = acceptFn;
    script.onerror = rejectFn;
    document.querySelector("head").appendChild(script);
    script.src = url;
  });
}
const TOH_BASE_URL = "https://openwrt.github.io/toh/toh/";
function initToH() {
  Promise.all([
    loadStyle("https://cdn.datatables.net/1.13.7/css/jquery.dataTables.css"),
    loadStyle(
      "https://cdn.datatables.net/searchpanes/2.2.0/css/searchPanes.dataTables.min.css"
    ),
    loadScript("https://code.jquery.com/jquery-3.7.0.js"),
  ])
    .then(function () {
      return loadScript(
        "https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js"
      );
    })
    .then(function () {
      return Promise.all([
        fetch(TOH_BASE_URL),
        loadScript(
          "https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js"
        ),
      ]);
    })
    .then(function (promises) {
      return promises[0].text();
    })
    .then(function (toh_table) {
      var parse = new DOMParser();
      var html = parse.parseFromString(toh_table, "text/html");
      document.querySelectorAll("div.wrap_toh").forEach(function (wrapper) {
        $(wrapper)
          .empty()
          .append(html.querySelector("#devices").cloneNode(true));
        // Setup - add a text input to each footer cell
        $(wrapper)
          .find("thead tr")
          .clone(true)
          .addClass("filters")
          .appendTo("#devices thead");
        // Init datatable
        var table = $(wrapper)
          .children("table")
          .DataTable({
            pageLength: 50,
            orderCellsTop: true,
            fixedHeader: true,
            initComplete: function () {
              var api = this.api();
              // For each column
              api
                .columns()
                .eq(0)
                .each(function (colIdx) {
                  // Set the header cell to contain the input element
                  var cell = $(".filters th").eq(
                    $(api.column(colIdx).header()).index()
                  );
                  var title = $(cell).text();
                  $(cell).html(
                    '<input type="text" placeholder="' + title + '" />'
                  );
                  // On every keypress in this input
                  $(
                    "input",
                    $(".filters th").eq($(api.column(colIdx).header()).index())
                  )
                    .off("keyup change")
                    .on("change", function (e) {
                      // Get the search value
                      $(this).attr("title", $(this).val());
                      var regexr = "({search})"; //$(this).parents('th').find('select').val();
                      var cursorPosition = this.selectionStart;
                      // Search the column for that value
                      api
                        .column(colIdx)
                        .search(
                          this.value != ""
                            ? regexr.replace(
                                "{search}",
                                "(((" + this.value + ")))"
                              )
                            : "",
                          this.value != "",
                          this.value == ""
                        )
                        .draw();
                    })
                    .on("keyup", function (e) {
                      e.stopPropagation();
                      $(this).trigger("change");
                      $(this)
                        .focus()[0]
                        .setSelectionRange(cursorPosition, cursorPosition);
                    });
                });
            },
          });
        wrapper.classList.forEach(function (className) {
          var m = className.match(/^wrap_toh_brand_(.+)$/);
          if (m) table.column(0).search(m[1]).draw();
        });
      });
    });
}
document.addEventListener("DOMContentLoaded", function () {
  if (document.querySelector("div.wrap_toh")) initToH();
});
