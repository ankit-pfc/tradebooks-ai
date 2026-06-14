// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { DataTable, type Column } from "./data-table"

// ── Fixtures ──────────────────────────────────────────────────────────────────

type Row = { id: string; name: string; amount: number }

const rows: Row[] = [
  { id: "r1", name: "Zerodha", amount: 5000 },
  { id: "r2", name: "Angel One", amount: 1200 },
  { id: "r3", name: "Groww", amount: 3800 },
]

const columns: Column<Row>[] = [
  {
    id: "name",
    header: "Name",
    cell: (row) => row.name,
    sortable: true,
    sortValue: (row) => row.name,
  },
  {
    id: "amount",
    header: "Amount",
    cell: (row) => row.amount,
    align: "right",
    sortable: true,
    sortValue: (row) => row.amount,
  },
]

const getRowId = (row: Row) => row.id

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DataTable", () => {
  // 1) renders rows + headers from data/columns
  it("renders column headers and all row data", () => {
    render(
      <DataTable data={rows} columns={columns} getRowId={getRowId} />
    )

    // Headers
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Amount")).toBeInTheDocument()

    // Row data
    expect(screen.getByText("Zerodha")).toBeInTheDocument()
    expect(screen.getByText("Angel One")).toBeInTheDocument()
    expect(screen.getByText("Groww")).toBeInTheDocument()
    expect(screen.getByText("5000")).toBeInTheDocument()
    expect(screen.getByText("1200")).toBeInTheDocument()
    expect(screen.getByText("3800")).toBeInTheDocument()
  })

  // 2) clicking a sortable header reorders rows and sets aria-sort
  it("sorts rows ascending then descending when clicking a sortable header, and sets aria-sort", () => {
    render(
      <DataTable data={rows} columns={columns} getRowId={getRowId} />
    )

    const nameHeader = screen.getByRole("columnheader", { name: /name/i })
    const sortBtn = within(nameHeader).getByRole("button")

    // Initial state: aria-sort = "none"
    expect(nameHeader).toHaveAttribute("aria-sort", "none")

    // First click → ascending
    fireEvent.click(sortBtn)
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending")

    // Rows should now be in alpha order: Angel One, Groww, Zerodha
    const cells = screen.getAllByRole("cell")
    const nameCells = cells.filter((c) =>
      ["Angel One", "Groww", "Zerodha"].includes(c.textContent ?? "")
    )
    expect(nameCells[0]).toHaveTextContent("Angel One")
    expect(nameCells[1]).toHaveTextContent("Groww")
    expect(nameCells[2]).toHaveTextContent("Zerodha")

    // Second click → descending
    fireEvent.click(sortBtn)
    expect(nameHeader).toHaveAttribute("aria-sort", "descending")

    const cellsDesc = screen.getAllByRole("cell")
    const nameCellsDesc = cellsDesc.filter((c) =>
      ["Angel One", "Groww", "Zerodha"].includes(c.textContent ?? "")
    )
    expect(nameCellsDesc[0]).toHaveTextContent("Zerodha")
    expect(nameCellsDesc[1]).toHaveTextContent("Groww")
    expect(nameCellsDesc[2]).toHaveTextContent("Angel One")
  })

  // 3) selection: clicking a row checkbox calls selection.onChange with that id;
  //    select-all selects all
  describe("selection", () => {
    it("calls onChange with the row id when a row checkbox is clicked", () => {
      const onChange = vi.fn()
      render(
        <DataTable
          data={rows}
          columns={columns}
          getRowId={getRowId}
          selection={{ selectedIds: [], onChange }}
        />
      )

      // Find the checkbox for "Zerodha" (r1)
      const rowCheckboxes = screen.getAllByRole("checkbox")
      // First checkbox is select-all, subsequent are row checkboxes
      const zerodhaCheckbox = rowCheckboxes[1] // r1 is first data row
      fireEvent.click(zerodhaCheckbox)

      expect(onChange).toHaveBeenCalledOnce()
      expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(["r1"]))
    })

    it("select-all checkbox selects all row ids", () => {
      const onChange = vi.fn()
      render(
        <DataTable
          data={rows}
          columns={columns}
          getRowId={getRowId}
          selection={{ selectedIds: [], onChange }}
        />
      )

      const selectAllCheckbox = screen.getByRole("checkbox", {
        name: /select all rows/i,
      })
      fireEvent.click(selectAllCheckbox)

      expect(onChange).toHaveBeenCalledOnce()
      const called = onChange.mock.calls[0][0] as string[]
      expect(called).toEqual(expect.arrayContaining(["r1", "r2", "r3"]))
      expect(called).toHaveLength(3)
    })

    it("deselects all when select-all is clicked while all rows are selected", () => {
      const onChange = vi.fn()
      const allIds = new Set(["r1", "r2", "r3"])
      render(
        <DataTable
          data={rows}
          columns={columns}
          getRowId={getRowId}
          selection={{ selectedIds: allIds, onChange }}
        />
      )

      const selectAllCheckbox = screen.getByRole("checkbox", {
        name: /select all rows/i,
      })
      fireEvent.click(selectAllCheckbox)

      expect(onChange).toHaveBeenCalledOnce()
      expect(onChange).toHaveBeenCalledWith([])
    })
  })

  // 4) empty data renders the emptyState; loading renders skeleton
  it("renders the custom emptyState when data is empty", () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        getRowId={getRowId}
        emptyState={<div>No batches yet</div>}
      />
    )
    expect(screen.getByText("No batches yet")).toBeInTheDocument()
  })

  it("renders the default EmptyState when data is empty and no emptyState prop", () => {
    render(
      <DataTable data={[]} columns={columns} getRowId={getRowId} />
    )
    expect(screen.getByText("No data")).toBeInTheDocument()
  })

  it("renders skeleton rows with animate-pulse when loading=true", () => {
    const { container } = render(
      <DataTable data={[]} columns={columns} getRowId={getRowId} loading />
    )
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument()
  })

  it("renders skeleton even when data is provided while loading", () => {
    const { container } = render(
      <DataTable data={rows} columns={columns} getRowId={getRowId} loading />
    )
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument()
    // rows should NOT be rendered
    expect(screen.queryByText("Zerodha")).not.toBeInTheDocument()
  })

  // Extras: error state, toolbar, onRowClick
  it("renders error node in a full-span cell", () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        getRowId={getRowId}
        error={<span>Something went wrong</span>}
      />
    )
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })

  it("renders toolbar and toolbarRight slots when provided", () => {
    render(
      <DataTable
        data={rows}
        columns={columns}
        getRowId={getRowId}
        toolbar={<span>Filter</span>}
        toolbarRight={<span>Export</span>}
      />
    )
    expect(screen.getByText("Filter")).toBeInTheDocument()
    expect(screen.getByText("Export")).toBeInTheDocument()
  })

  it("calls onRowClick when a row is clicked", () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        data={rows}
        columns={columns}
        getRowId={getRowId}
        onRowClick={onRowClick}
      />
    )
    // First buttons may be sort buttons; find the data rows by tabIndex
    const dataRowButtons = screen
      .getAllByRole("button")
      .filter((el) => el.tagName === "TR")
    // Click the first row (Zerodha after no sort)
    fireEvent.click(dataRowButtons[0])
    expect(onRowClick).toHaveBeenCalledOnce()
  })
})
